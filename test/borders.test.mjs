// Filling a map's blanks from the maps just before it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CARRY_MAPS, CARRY_YEARS, MAPS, earlierMaps, mapFor, territoryAt } from '../src/data/borders.js';

const square = (name, west, south, east, north) => ({
  name,
  box: [west, south, east, north],
  polygons: [[[[west, south], [east, south], [east, north], [west, north], [west, south]]]],
});

test('the nearest map is chosen for a year', () => {
  assert.equal(mapFor(26).file, 'bc1');
  assert.equal(mapFor(1069).file, '1100');
  assert.equal(mapFor(2026).file, '2010');
  assert.equal(mapFor(-400000), null);
});

test('only recent maps may fill blanks', () => {
  const by = (file) => MAPS.find((m) => m.file === file);
  assert.deepEqual(earlierMaps(by('1100')).map((m) => m.file), ['1000', '900', '800']);
  // 1279 and 1300 are 21 years apart: the count limit applies, not the years.
  assert.deepEqual(earlierMaps(by('1400')).map((m) => m.file), ['1300', '1279', '1200']);
  // Ancient maps are millennia apart, so nothing is recent enough to carry.
  assert.deepEqual(earlierMaps(by('bc3000')), []);
  for (const map of MAPS) {
    const earlier = earlierMaps(map);
    assert.ok(earlier.length <= CARRY_MAPS);
    assert.ok(earlier.every((m) => m.year < map.year && map.year - m.year <= CARRY_YEARS));
  }
});

test('a blank piece of land takes the last holder known from an earlier map', () => {
  const view = {
    year: 1100,
    named: [square('Song', 20, 0, 30, 10)],
    blank: [square(null, 0, 0, 10, 10)],
    carried: [
      { year: 1000, named: [] }, // also silent here
      { year: 900, named: [square('Malay', 0, 0, 10, 10), square('Old Song', 20, 0, 30, 10)] },
    ],
  };
  // Named on this map: its own answer, whatever older maps said.
  assert.equal(territoryAt(view, { lat: 5, lng: 25 }).name, 'Song');
  assert.equal(territoryAt(view, { lat: 5, lng: 25 }).carriedFrom, undefined);
  // Blank on this map: the nearest earlier map that names someone.
  const carried = territoryAt(view, { lat: 5, lng: 5 });
  assert.equal(carried.name, 'Malay');
  assert.equal(carried.carriedFrom, 900);
  // Sea on this map stays sea, even where an older map had land.
  assert.equal(territoryAt({ ...view, blank: [] }, { lat: 5, lng: 5 }), null);
  // Without earlier maps a blank stays blank.
  assert.equal(territoryAt({ ...view, carried: [] }, { lat: 5, lng: 5 }), null);
});
