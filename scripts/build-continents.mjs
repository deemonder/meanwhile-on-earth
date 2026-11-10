// Builds public/data/continents/<age>.json: where the continents were.
//
// The outlines come from the GPlates Web Service (https://gws.gplates.org),
// which moves today's coastlines back along the plate motions of a published
// model. The model used here is Müller et al. 2022 (Solid Earth 13, CC BY 4.0),
// which reaches one billion years into the past.
//
// These are today's coasts carried by their plates, not the true shorelines of
// the time: sea level and erosion changed those, and much old crust is gone.
//
//   npm run build-continents
//
// The service returns about 2 MB per age. Each age is boiled down to a few
// tens of kilobytes: small islands dropped, outlines simplified, coordinates
// rounded to a tenth of a degree and stored as differences.

import { mkdir, writeFile } from 'node:fs/promises';
import { DRIFT_AGES } from '../src/data/continents.js';

const SERVICE = 'https://gws.gplates.org/reconstruct/coastlines/';
const MODEL = 'MULLER2022';
const USER_AGENT = 'meanwhile-on-earth-data-builder/0.1 (educational open-source project)';
const OUT = new URL('../public/data/continents/', import.meta.url);

const MIN_AREA = 0.8; // square degrees; smaller islands are dropped
const TOLERANCE = 0.22; // degrees; detail finer than this is smoothed away

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchCoastlines(age, tries = 4) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(`${SERVICE}?time=${age}&model=${MODEL}`, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(90_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()).features;
    } catch (err) {
      if (attempt >= tries) throw err;
      await sleep(5000 * attempt);
    }
  }
}

function area(ring) {
  let twice = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    twice += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  }
  return Math.abs(twice) / 2;
}

/** Douglas–Peucker: keeps only the points that shape the outline. */
function simplify(points, tolerance) {
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop();
    const [ax, ay] = points[first];
    const [bx, by] = points[last];
    const dx = bx - ax;
    const dy = by - ay;
    const length = Math.hypot(dx, dy);
    let worst = 0;
    let index = -1;
    for (let i = first + 1; i < last; i++) {
      // A closed outline starts and ends at the same point, so there is no
      // chord to measure from: use the distance from that point instead.
      const distance = length
        ? Math.abs(dy * (points[i][0] - ax) - dx * (points[i][1] - ay)) / length
        : Math.hypot(points[i][0] - ax, points[i][1] - ay);
      if (distance > worst) {
        worst = distance;
        index = i;
      }
    }
    if (worst > tolerance) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/** [x0, y0, dx1, dy1, …] in tenths of a degree. */
function encode(ring) {
  const out = [];
  let px = 0;
  let py = 0;
  for (const [lng, lat] of ring) {
    const x = Math.round(lng * 10);
    const y = Math.round(lat * 10);
    if (out.length && x === px && y === py) continue; // rounding made a duplicate
    out.push(x - px, y - py);
    px = x;
    py = y;
  }
  return out;
}

await mkdir(OUT, { recursive: true });
let totalBytes = 0;
for (const age of DRIFT_AGES) {
  const features = await fetchCoastlines(age);
  const rings = [];
  for (const feature of features) {
    const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
    for (const [outline] of polygons) {
      if (area(outline) < MIN_AREA) continue;
      const simple = simplify(outline, TOLERANCE);
      if (simple.length >= 4) rings.push(encode(simple));
    }
  }
  const json = JSON.stringify({ age, model: MODEL, rings });
  await writeFile(new URL(`${age}.json`, OUT), json);
  totalBytes += json.length;
  const points = rings.reduce((sum, ring) => sum + ring.length / 2, 0);
  console.log(`${String(age).padStart(5)} My  ${String(rings.length).padStart(4)} outlines  ${String(points).padStart(6)} points  ${(json.length / 1024).toFixed(0)} KB`);
  await sleep(1000); // one request a second is plenty
}
console.log(`\n${DRIFT_AGES.length} ages, ${(totalBytes / 1e6).toFixed(1)} MB in public/data/continents/`);
