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
import { pack, ringArea, simplify } from '../src/data/outlines.js';

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

await mkdir(OUT, { recursive: true });
let totalBytes = 0;
for (const age of DRIFT_AGES) {
  const features = await fetchCoastlines(age);
  const rings = [];
  for (const feature of features) {
    const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
    for (const [outline] of polygons) {
      if (ringArea(outline) < MIN_AREA) continue;
      const simple = simplify(outline, TOLERANCE);
      if (simple.length >= 4) rings.push(pack(simple));
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
