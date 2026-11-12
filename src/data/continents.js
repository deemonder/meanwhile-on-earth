// Continental drift: where the land was, millions of years ago.
//
// One file per age (see scripts/build-continents.mjs), each holding the
// outlines of the continents as the plate model of Müller et al. 2022 places
// them. They are today's coastlines carried along by their plates.

import { unpack } from './outlines.js';

/** Ages with a reconstruction, in millions of years: every 10 up to 550, then every 25. */
export const DRIFT_AGES = [
  ...Array.from({ length: 55 }, (_, i) => (i + 1) * 10),
  ...Array.from({ length: 18 }, (_, i) => 575 + i * 25),
];

/** The plate model stops here. Older arrangements are not known. */
export const OLDEST_KNOWN = 1000e6;

/** Before this the continents were so close to today's that the real picture is used. */
const YOUNGEST = 5e6;

/** The reconstruction closest to `age` (in years), or null when none is needed. */
export function driftAgeFor(age) {
  if (age < YOUNGEST) return null;
  const millions = Math.min(age, OLDEST_KNOWN) / 1e6;
  return DRIFT_AGES.reduce((best, a) => (Math.abs(a - millions) < Math.abs(best - millions) ? a : best));
}

/**
 * How far from the poles ice sheets reached on land, as a latitude, or null in
 * the long stretches when the planet had no polar ice at all. Rough values for
 * the three ice ages of the last half billion years.
 */
export function polarIceEdge(age) {
  const millions = age / 1e6;
  if (millions < 34) return 68; // Antarctica, then the northern sheets
  if (millions >= 260 && millions <= 340) return 52; // late Paleozoic: Gondwana over the south pole
  if (millions >= 440 && millions <= 450) return 58; // end of the Ordovician
  return null;
}

const loaded = new Map();

/** Resolves to the outlines for one age: a list of rings, each a list of [lng, lat]. */
export function loadContinents(age) {
  if (!loaded.has(age)) {
    const pending = fetch(`${import.meta.env.BASE_URL}data/continents/${age}.json`)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then(({ rings }) => rings.map(unpack))
      .catch((error) => {
        loaded.delete(age); // let a later attempt retry
        throw error;
      });
    loaded.set(age, pending);
  }
  return loaded.get(age);
}

/** True when the point lies on reconstructed land. */
export function onLand(rings, { lat, lng }) {
  for (const ring of rings) {
    const [west, south, east, north] = ring.box;
    if (lng < west || lng > east || lat < south || lat > north) continue;
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
    }
    if (inside) return true;
  }
  return false;
}

// Land colour by latitude, pole to pole: tundra, forest, desert belt, rainforest.
const CLIMATE = [
  [0.0, '#8d8f86'], [0.1, '#6f7a5c'], [0.22, '#4f6f3c'], [0.33, '#b79a63'], [0.4, '#a98c58'],
  [0.5, '#3f6b33'],
  [0.6, '#a98c58'], [0.67, '#b79a63'], [0.78, '#4f6f3c'], [0.9, '#6f7a5c'], [1.0, '#8d8f86'],
];

/**
 * Paints the continents onto an equirectangular canvas for the globe shader:
 * opaque land, a faint halo of shallow sea around it, transparent open ocean.
 *
 * @param {number|null} iceEdge  latitude beyond which land is under ice, if any
 */
export function paintContinents(canvas, rings, iceEdge) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  const x = (lng) => ((lng + 180) / 360) * width;
  const y = (lat) => ((90 - lat) / 180) * height;
  ctx.clearRect(0, 0, width, height);
  ctx.lineJoin = 'round';

  const land = new Path2D();
  // The outlines arrive cut along the date line. Those cut edges must not be
  // stroked, or a seam would run down the Pacific.
  const coast = new Path2D();
  const onSeam = ([lng]) => Math.abs(lng) > 179.9;
  for (const ring of rings) {
    ring.forEach(([lng, lat], i) => {
      if (i) land.lineTo(x(lng), y(lat));
      else land.moveTo(x(lng), y(lat));
      const previous = ring[i ? i - 1 : ring.length - 1];
      if (i === 0 || (onSeam(previous) && onSeam([lng]))) coast.moveTo(x(lng), y(lat));
      else coast.lineTo(x(lng), y(lat));
    });
    land.closePath();
  }

  // Shallow seas over the continental shelves.
  ctx.save();
  ctx.filter = `blur(${width / 340}px)`;
  ctx.strokeStyle = 'rgba(70, 160, 190, 0.42)';
  ctx.lineWidth = width / 90;
  ctx.stroke(coast);
  ctx.restore();

  const climate = ctx.createLinearGradient(0, 0, 0, height);
  for (const [stop, colour] of CLIMATE) climate.addColorStop(stop, colour);
  ctx.fillStyle = climate;
  ctx.fill(land);
  // A continent comes as several plates side by side. Simplifying their
  // outlines leaves hairline gaps between them; a stroke in the land colour
  // closes those, so the shallow-sea halo does not show through as cracks.
  ctx.strokeStyle = climate;
  ctx.lineWidth = width / 600;
  ctx.stroke(land);

  if (iceEdge !== null) {
    ctx.save();
    ctx.clip(land);
    const soft = 6; // degrees over which the ice thins out
    for (const sign of [1, -1]) {
      const ice = ctx.createLinearGradient(0, y(sign * (iceEdge - soft)), 0, y(sign * (iceEdge + soft)));
      ice.addColorStop(0, 'rgba(236, 242, 250, 0)');
      ice.addColorStop(1, 'rgba(236, 242, 250, 1)');
      ctx.fillStyle = ice;
      const top = Math.min(y(sign * 90), y(sign * (iceEdge - soft)));
      const bottom = Math.max(y(sign * 90), y(sign * (iceEdge - soft)));
      ctx.fillRect(0, top, width, bottom - top);
    }
    ctx.restore();
  }
}
