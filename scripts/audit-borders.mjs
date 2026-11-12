// Measures where the historical maps contradict themselves over time, and
// writes the territories the dataset lacks (public/data/map-additions.json).
//
// The maps are 53 separate snapshots drawn by hand. Nothing forces one to
// agree with the next: the share of land that carries a name swings between
// 62% and 100% from map to map, so a land can be named in one map, left blank
// in the next and named again after that. Drawn as they are, countries would
// vanish and come back as the years go by.
//
// The app softens this (see src/data/borders.js): where a map draws land
// without a name, it shows the holder from a map up to CARRY_MAPS steps and
// CARRY_YEARS years earlier, marked as carried over. This script follows a
// grid of points through all the maps and reports how many such blanks there
// are, and how many the rule fills.
//
//   npm run audit-borders             prints the report
//   npm run audit-borders -- --write  also rewrites public/data/map-additions.json
//
// The maps are downloaded once into the system's temporary folder.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CARRY_MAPS, CARRY_YEARS, MAPS, MAPS_URL, earlierMaps } from '../src/data/borders.js';

const GRID = 2; // degrees between sample points

// Territories the dataset lacks, taken from Natural Earth (public domain).
const NATURAL_EARTH =
  'https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@v5.1.2/geojson/ne_50m_admin_0_countries.geojson';
const ADDITIONS = [
  {
    // Kosovo declared independence from Serbia in February 2008, and the 2010
    // map still draws it inside Serbia. Its status is disputed: roughly half
    // of the UN's members recognise it; Serbia and others do not. The app
    // draws it and says that it is disputed.
    maps: ['2010'],
    name: 'Kosovo',
    naturalEarthName: 'Kosovo',
    disputed: true,
  },
];

const cache = join(tmpdir(), 'meanwhile-on-earth-maps');
await mkdir(cache, { recursive: true });

async function cached(file, url) {
  const path = join(cache, file);
  try {
    return await readFile(path, 'utf8');
  } catch {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
    const text = await response.text();
    await writeFile(path, text);
    return text;
  }
}

async function load(map) {
  const text = await cached(`world_${map.file}.geojson`, `${MAPS_URL}world_${map.file}.geojson`);
  return JSON.parse(text)
    .features.filter((f) => f.geometry)
    .map((f) => {
      const polygons = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
      let west = 180, south = 90, east = -180, north = -90;
      for (const [outline] of polygons) {
        for (const [x, y] of outline) {
          if (x < west) west = x;
          if (x > east) east = x;
          if (y < south) south = y;
          if (y > north) north = y;
        }
      }
      return { name: f.properties.NAME ?? '', polygons, box: [west, south, east, north] };
    });
}

function inRing(ring, x, y) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** A territory's name, '' for land nobody is named on, null for sea. */
function nameAt(features, lat, lng) {
  let land = null;
  for (const f of features) {
    const [west, south, east, north] = f.box;
    if (lng < west || lng > east || lat < south || lat > north) continue;
    if (f.polygons.some(([outline, ...holes]) => inRing(outline, lng, lat) && !holes.some((h) => inRing(h, lng, lat)))) {
      if (f.name) return f.name;
      land = '';
    }
  }
  return land;
}

const features = [];
for (const map of MAPS) features.push(await load(map));

// Follow every grid point through all the maps: as drawn, and as the app shows it.
const points = [];
for (let lat = -58; lat <= 80; lat += GRID) {
  for (let lng = -179; lng < 180; lng += GRID) {
    const drawn = features.map((f) => nameAt(f, lat, lng));
    if (drawn.every((name) => name === null)) continue;
    const shown = drawn.map((name, i) => {
      if (name !== '') return name;
      for (const earlier of earlierMaps(MAPS[i])) {
        const held = drawn[MAPS.findIndex((m) => m.file === earlier.file)];
        if (held) return held;
      }
      return '';
    });
    points.push({ drawn, shown });
  }
}

/** Points blank in map i although both neighbouring maps name them: a country blinking out. */
const blinks = (key, i) =>
  i === 0 || i === MAPS.length - 1
    ? 0
    : points.filter((p) => p[key][i] === '' && p[key][i - 1] && p[key][i + 1]).length;

console.log(`${points.length} land points, every ${GRID}°, followed through ${MAPS.length} maps`);
console.log(`Carry rule: up to ${CARRY_MAPS} maps and ${CARRY_YEARS} years back\n`);
console.log('     map   named as drawn   named as shown   blinks as drawn   blinks as shown');
let before = 0;
let after = 0;
MAPS.forEach((map, i) => {
  const land = points.filter((p) => p.drawn[i] !== null).length;
  const share = (key) => `${Math.round((100 * points.filter((p) => p[key][i]).length) / land)}%`;
  const drawn = blinks('drawn', i);
  const shown = blinks('shown', i);
  before += drawn;
  after += shown;
  if (drawn > land * 0.02 || shown > land * 0.02) {
    console.log(
      `${map.file.padStart(8)}   ${share('drawn').padStart(14)}   ${share('shown').padStart(14)}   ` +
        `${String(drawn).padStart(15)}   ${String(shown).padStart(15)}`,
    );
  }
});
console.log(`\nPlaces blinking out for one map: ${before} as drawn, ${after} as shown`);

// What the dataset lacks.
const naturalEarth = JSON.parse(await cached('natural-earth-50m.geojson', NATURAL_EARTH));
const additions = {};
for (const addition of ADDITIONS) {
  const source = naturalEarth.features.find((f) => f.properties.ADMIN === addition.naturalEarthName);
  if (!source) throw new Error(`Natural Earth has no "${addition.naturalEarthName}"`);
  const polygons = source.geometry.type === 'Polygon' ? [source.geometry.coordinates] : source.geometry.coordinates;
  const rounded = polygons.map((rings) => rings.map((ring) => ring.map(([x, y]) => [+x.toFixed(3), +y.toFixed(3)])));
  for (const file of addition.maps) {
    (additions[file] ??= []).push({ name: addition.name, disputed: addition.disputed, polygons: rounded });
  }
}
console.log(`Added territories: ${ADDITIONS.map((a) => `${a.name} (${a.maps.join(', ')})`).join('; ')}`);

if (process.argv.includes('--write')) {
  const json = JSON.stringify(additions);
  await writeFile(new URL('../public/data/map-additions.json', import.meta.url), json);
  console.log(`Wrote public/data/map-additions.json (${(json.length / 1024).toFixed(1)} KB)`);
}
