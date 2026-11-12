// Filling a map's blanks from the maps just before it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mapFor, territoryAt } from '../src/data/borders.js';
import { pack, ringArea, simplify, unpack } from '../src/data/outlines.js';

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

test('outlines survive packing, to a tenth of a degree', () => {
  const ring = [[12.34, 41.9], [13.02, 42.11], [12.71, 43.48], [12.34, 41.9]];
  const back = unpack(pack(ring));
  assert.equal(back.length, ring.length);
  back.forEach(([lng, lat], i) => {
    assert.ok(Math.abs(lng - ring[i][0]) <= 0.05 && Math.abs(lat - ring[i][1]) <= 0.05);
  });
  assert.deepEqual(back.box, [12.3, 41.9, 13, 43.5]);
});

test('simplifying keeps the shape of a closed outline', () => {
  // A square with many points along each side: only the corners matter.
  const side = (from, to) => Array.from({ length: 10 }, (_, i) => [from[0] + ((to[0] - from[0]) * i) / 10, from[1] + ((to[1] - from[1]) * i) / 10]);
  const square = [...side([0, 0], [10, 0]), ...side([10, 0], [10, 10]), ...side([10, 10], [0, 10]), ...side([0, 10], [0, 0]), [0, 0]];
  const simple = simplify(square, 0.1);
  assert.ok(simple.length <= 6, `kept ${simple.length} points`);
  assert.ok(Math.abs(ringArea(simple) - 100) < 1);
});
