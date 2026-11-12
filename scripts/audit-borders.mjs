// Measures where the historical maps contradict themselves over time, and
// writes what the app needs to paper over it:
//
//   public/data/carried/<map>.json   territories from earlier maps that fill a map's blanks
//   public/data/map-additions.json   territories the dataset lacks altogether
//
// The maps are 53 separate snapshots drawn by hand. Nothing forces one to
// agree with the next: the share of land that carries a name swings between
// 62% and 100% from map to map, so a land can be named in one map, left blank
// in the next and named again after that. Drawn as they are, countries would
// vanish and come back as the years go by.
//
// THE RULE. Where a map draws land without a name, the last holder named by an
// earlier map is shown instead (and marked as carried over), provided that
//
//   - that earlier map is at most RECENT years older, or
//   - the place is named again by a later map no more than BRIDGE years after
//     the earlier one. A place that is named, blank for a map or two and then
//     named again is far likelier a gap in those maps than a state that came
//     apart and re-formed.
//
// Nothing is carried across more than BRIDGE years. The prehistoric maps are
// thousands of years apart, and a blank between them is honest ignorance.
//
//   npm run audit-borders             prints the report
//   npm run audit-borders -- --write  also rewrites the files above
//
// The maps are downloaded once into the system's temporary folder.

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MAPS, MAPS_URL } from '../src/data/borders.js';
import { pack, simplify } from '../src/data/outlines.js';

const RECENT = 300; // years
const BRIDGE = 600; // years
const GRID = 2; // degrees between the points used for the report
const DETAIL = 0.08; // degrees: outlines of carried territories are simplified to this

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
  const all = JSON.parse(text)
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
      const { NAME, SUBJECTO, PARTOF } = f.properties;
      const overlord = SUBJECTO && SUBJECTO !== NAME ? SUBJECTO : PARTOF && PARTOF !== NAME ? PARTOF : null;
      return { name: NAME ?? '', overlord, polygons, box: [west, south, east, north] };
    });
  return { ...map, named: all.filter((f) => f.name), blank: all.filter((f) => !f.name) };
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

const contains = (feature, lat, lng) => {
  const [west, south, east, north] = feature.box;
  if (lng < west || lng > east || lat < south || lat > north) return false;
  return feature.polygons.some(
    ([outline, ...holes]) => inRing(outline, lng, lat) && !holes.some((hole) => inRing(hole, lng, lat)),
  );
};
const featureAt = (features, lat, lng) => features.find((f) => contains(f, lat, lng)) ?? null;

const maps = [];
for (const map of MAPS) maps.push(await load(map));

/**
 * Who the app shows at a point that map `i` leaves blank: the territory, and
 * the index of the earlier map it comes from. Null when the rule carries nothing.
 */
function carriedAt(i, lat, lng) {
  for (let k = i - 1; k >= 0 && maps[i].year - maps[k].year <= BRIDGE; k--) {
    const holder = featureAt(maps[k].named, lat, lng);
    if (!holder) continue;
    if (maps[i].year - maps[k].year <= RECENT) return { holder, from: k };
    // Older than that: only if the gap closes, with a later map naming the place again.
    for (let j = i + 1; j < maps.length && maps[j].year - maps[k].year <= BRIDGE; j++) {
      if (featureAt(maps[j].named, lat, lng)) return { holder, from: k };
    }
    return null;
  }
  return null;
}

/** Points inside a piece of land: a one-degree grid over it, plus the middle of each of its parts. */
function samplePoints(feature) {
  const points = [];
  for (const [outline] of feature.polygons) {
    let x = 0, y = 0;
    for (const [px, py] of outline) {
      x += px;
      y += py;
    }
    points.push([y / outline.length, x / outline.length]);
  }
  const [west, south, east, north] = feature.box;
  for (let lat = Math.ceil(south); lat <= north; lat++) {
    for (let lng = Math.ceil(west); lng <= east; lng++) points.push([lat, lng]);
  }
  return points.filter(([lat, lng]) => contains(feature, lat, lng));
}

// ── Which earlier territories each map needs ──
const carried = maps.map((map, i) => {
  const bySource = new Map(); // index of earlier map → set of its territories
  for (const piece of map.blank) {
    for (const [lat, lng] of samplePoints(piece)) {
      const hit = carriedAt(i, lat, lng);
      if (!hit) continue;
      if (!bySource.has(hit.from)) bySource.set(hit.from, new Set());
      bySource.get(hit.from).add(hit.holder);
    }
  }
  // Nearest map first: where two earlier maps both name a place, the later one wins.
  return [...bySource].sort((a, b) => b[0] - a[0]).map(([from, holders]) => ({
    year: maps[from].year,
    territories: [...holders].map((holder) => ({
      name: holder.name,
      overlord: holder.overlord,
      rings: holder.polygons.map(([outline]) => {
        const simple = simplify(outline, DETAIL);
        return pack(simple.length >= 4 ? simple : outline); // small islands survive whole
      }),
    })),
  }));
});

// ── Report: follow a grid of points through all the maps ──
const points = [];
for (let lat = -58; lat <= 80; lat += GRID) {
  for (let lng = -179; lng < 180; lng += GRID) {
    const drawn = maps.map((m) => featureAt(m.named, lat, lng)?.name ?? (featureAt(m.blank, lat, lng) ? '' : null));
    if (drawn.every((name) => name === null)) continue;
    const shown = drawn.map((name, i) => (name === '' ? (carriedAt(i, lat, lng)?.holder.name ?? '') : name));
    points.push({ drawn, shown });
  }
}
/** Blank in map i although both neighbouring maps show a name: a place blinking out. */
const blinks = (key, i) =>
  i === 0 || i === maps.length - 1 ? [] : points.filter((p) => p[key][i] === '' && p[key][i - 1] && p[key][i + 1]);
const count = (key) => maps.reduce((sum, _, i) => sum + blinks(key, i).length, 0);
const named = (key) => {
  const land = points.reduce((sum, p) => sum + p.drawn.filter((n) => n !== null).length, 0);
  return Math.round((100 * points.reduce((sum, p) => sum + p[key].filter(Boolean).length, 0)) / land);
};

console.log(`${points.length} land points, every ${GRID}°, followed through ${maps.length} maps`);
console.log(`Rule: carry up to ${RECENT} years, or across a gap that closes within ${BRIDGE} years\n`);
console.log(`Land with a name:               ${named('drawn')}% as drawn, ${named('shown')}% as shown`);
console.log(`Places blinking out for a map:  ${count('drawn')} as drawn, ${count('shown')} as shown`);

const left = new Map();
maps.forEach((map, i) => {
  for (const p of blinks('shown', i)) {
    const key = `${map.file}: ${p.shown[i - 1]} → blank → ${p.shown[i + 1]}`;
    left.set(key, (left.get(key) ?? 0) + 1);
  }
});
if (left.size) {
  console.log(`\nStill blinking (the gap is longer than ${BRIDGE} years):`);
  for (const [what, n] of [...left].sort((a, b) => b[1] - a[1]).slice(0, 12)) console.log(`  ${String(n).padStart(4)}  ${what}`);
}

// ── What the dataset lacks ──
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
console.log(`\nAdded territories: ${ADDITIONS.map((a) => `${a.name} (${a.maps.join(', ')})`).join('; ')}`);

if (process.argv.includes('--write')) {
  const data = new URL('../public/data/', import.meta.url);
  await writeFile(new URL('map-additions.json', data), JSON.stringify(additions));
  await rm(new URL('carried/', data), { recursive: true, force: true });
  await mkdir(new URL('carried/', data), { recursive: true });
  let bytes = 0;
  let files = 0;
  for (const [i, layers] of carried.entries()) {
    if (!layers.length) continue;
    const json = JSON.stringify({ map: maps[i].file, layers });
    await writeFile(new URL(`carried/${maps[i].file}.json`, data), json);
    bytes += json.length;
    files++;
  }
  console.log(`Wrote map-additions.json and ${files} files in public/data/carried/ (${(bytes / 1e6).toFixed(1)} MB)`);
}
