// Who ruled where, and when.
//
// Maps come from the "historical-basemaps" project by André Ourednik
// (https://github.com/aourednik/historical-basemaps, GPL-3.0): one GeoJSON
// world map for each of 53 dates between 123,000 BC and 2010. They are loaded
// from a CDN when needed rather than copied into this repository.
//
// The maps are separate snapshots, drawn one at a time, and they do not always
// agree: a land can be named in one, left blank in the next and named again
// later (scripts/audit-borders.mjs measures how often). Shown as they are,
// countries would blink out and back as the years go by. So where a map is
// silent about a piece of land, the last holder known from a slightly earlier
// map is shown instead, and marked as carried over.

// One fixed version of the dataset. The maps are still being edited upstream,
// and anything measured or added here refers to this version.
const VERSION = '4b5039e50d8d2464b065bd76ad6086cd4597108d'; // 2 November 2026
export const MAPS_URL = `https://cdn.jsdelivr.net/gh/aourednik/historical-basemaps@${VERSION}/geojson/`;
const SOURCES = [MAPS_URL, `https://raw.githubusercontent.com/aourednik/historical-basemaps/${VERSION}/geojson/`];

const FILES = [
  'bc123000', 'bc10000', 'bc8000', 'bc5000', 'bc4000', 'bc3000', 'bc2000', 'bc1500', 'bc1000',
  'bc700', 'bc500', 'bc400', 'bc323', 'bc300', 'bc200', 'bc100', 'bc1',
  '100', '200', '300', '400', '500', '600', '700', '800', '900', '1000', '1100', '1200', '1279',
  '1300', '1400', '1492', '1500', '1530', '1600', '1650', '1700', '1715', '1783', '1800', '1815',
  '1880', '1900', '1914', '1920', '1930', '1938', '1945', '1960', '1994', '2000', '2010',
];

// Astronomical years: "bc1" is 1 BC, which is year 0.
export const MAPS = FILES.map((file) => ({
  file,
  year: file.startsWith('bc') ? 1 - Number(file.slice(2)) : Number(file),
}));

/** Before this the oldest map (archaic humans, 123,000 BC) no longer applies. */
const OLDEST_YEAR = -300000;

/** How far back a map may be to vouch for land that a later map leaves blank. */
export const CARRY_YEARS = 300;
export const CARRY_MAPS = 3;

/** The map closest in time to `year`, or null when none is relevant. */
export function mapFor(year) {
  if (year < OLDEST_YEAR) return null;
  return MAPS.reduce((best, map) => (Math.abs(map.year - year) < Math.abs(best.year - year) ? map : best));
}

/** The maps just before `map` whose territories can fill its blanks, nearest first. */
export function earlierMaps(map) {
  const at = MAPS.findIndex((m) => m.file === map.file);
  return MAPS.slice(Math.max(0, at - CARRY_MAPS), at)
    .reverse()
    .filter((m) => map.year - m.year <= CARRY_YEARS);
}

const loaded = new Map();
let additions = null;

/** Territories missing from the dataset altogether (see scripts/audit-borders.mjs). */
function loadAdditions() {
  additions ??= fetch(`${import.meta.env.BASE_URL}data/map-additions.json`)
    .then((response) => (response.ok ? response.json() : {}))
    .catch(() => ({}));
  return additions;
}

/**
 * Resolves to one map: `named` territories and the `blank` pieces of land it
 * draws without a name. Results are cached.
 */
export function loadMap(map) {
  if (!loaded.has(map.file)) {
    const pending = Promise.all([download(`world_${map.file}.geojson`), loadAdditions()])
      .then(([geojson, extra]) => {
        const features = geojson.features.filter((f) => f.geometry);
        const added = (extra[map.file] ?? []).map((a) =>
          toTerritory({ properties: { NAME: a.name }, geometry: { type: 'MultiPolygon', coordinates: a.polygons } }, a),
        );
        return {
          year: map.year,
          // Added territories come first: they lie on top of whatever the map drew there.
          named: [...added, ...features.filter((f) => f.properties?.NAME).map((f) => toTerritory(f))],
          blank: features.filter((f) => !f.properties?.NAME).map((f) => toTerritory(f)),
        };
      })
      .catch((error) => {
        loaded.delete(map.file); // let a later attempt retry
        throw error;
      });
    loaded.set(map.file, pending);
  }
  return loaded.get(map.file);
}

async function download(name) {
  let lastError;
  for (const base of SOURCES) {
    try {
      const response = await fetch(base + name);
      if (response.ok) return await response.json();
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

function toTerritory(feature, extra = {}) {
  const { NAME, SUBJECTO, PARTOF } = feature.properties;
  const polygons =
    feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;

  let west = 180, south = 90, east = -180, north = -90;
  let biggest = { area: 0, lat: 0, lng: 0 };
  let area = 0;
  for (const [outline] of polygons) {
    for (const [lng, lat] of outline) {
      if (lng < west) west = lng;
      if (lng > east) east = lng;
      if (lat < south) south = lat;
      if (lat > north) north = lat;
    }
    const piece = measure(outline);
    area += piece.area;
    if (piece.area > biggest.area) biggest = piece;
  }

  // Provinces and vassals share the colour of the power they answer to.
  const overlord = SUBJECTO && SUBJECTO !== NAME ? SUBJECTO : PARTOF && PARTOF !== NAME ? PARTOF : null;
  return {
    name: NAME ?? null,
    overlord,
    hue: hueOf(overlord ?? NAME ?? ''),
    polygons,
    box: [west, south, east, north],
    area,
    label: { lat: biggest.lat, lng: biggest.lng },
    disputed: Boolean(extra.disputed),
    added: 'disputed' in extra || 'name' in extra,
  };
}

/** Area (in square degrees at the equator) and centroid of a ring. */
function measure(ring) {
  let twiceArea = 0, cx = 0, cy = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const cross = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
    twiceArea += cross;
    cx += (ring[j][0] + ring[i][0]) * cross;
    cy += (ring[j][1] + ring[i][1]) * cross;
  }
  if (Math.abs(twiceArea) < 1e-9) return { area: 0, lat: ring[0][1], lng: ring[0][0] };
  const lat = cy / (3 * twiceArea);
  const lng = cx / (3 * twiceArea);
  return { area: (Math.abs(twiceArea) / 2) * Math.cos((lat * Math.PI) / 180), lat, lng };
}

function hueOf(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return hash % 360;
}

function ringContains(ring, lng, lat) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function pieceAt(pieces, { lat, lng }) {
  for (const piece of pieces) {
    const [west, south, east, north] = piece.box;
    if (lng < west || lng > east || lat < south || lat > north) continue;
    for (const [outline, ...holes] of piece.polygons) {
      if (ringContains(outline, lng, lat) && !holes.some((hole) => ringContains(hole, lng, lat))) return piece;
    }
  }
  return null;
}

/**
 * The territory at a point, or null over sea and over land with no record.
 *
 * `view` is a map as returned by loadMap, optionally with `carried`: earlier
 * maps, nearest first. Where the map itself names nobody but draws land, the
 * nearest earlier map that names someone there answers instead, and the
 * result says so with `carriedFrom` (that map's year).
 */
export function territoryAt(view, point) {
  const own = pieceAt(view.named, point);
  if (own) return own;
  if (!view.carried?.length || !pieceAt(view.blank, point)) return null;
  for (const earlier of view.carried) {
    const held = pieceAt(earlier.named, point);
    if (held) return { ...held, carriedFrom: earlier.year };
  }
  return null;
}

// ───────── Painting ─────────

let scratch = null;

/** Traces territories as one path in canvas coordinates. */
function trace(ctx, pieces, x, y) {
  ctx.beginPath();
  for (const piece of pieces) {
    for (const rings of piece.polygons) {
      for (const ring of rings) {
        ring.forEach(([lng, lat], i) => (i ? ctx.lineTo(x(lng), y(lat)) : ctx.moveTo(x(lng), y(lat))));
        ctx.closePath();
      }
    }
  }
}

/** Fills and outlines each territory in its own colour. */
function colour(ctx, territories, x, y, width, replace) {
  for (const territory of territories) {
    trace(ctx, [territory], x, y);
    if (replace) {
      // Clear what is underneath first, so two see-through colours never mix.
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = '#000';
      ctx.fill('evenodd');
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.fillStyle = `hsla(${territory.hue}, 75%, 58%, 0.34)`;
    ctx.fill('evenodd');
    ctx.strokeStyle = `hsla(${territory.hue}, 85%, 78%, 0.9)`;
    ctx.lineWidth = width / 2048;
    ctx.stroke();
  }
}

/**
 * Paints a map onto an equirectangular canvas (longitude across, latitude
 * down), which the globe then wraps around the planet. One texture is far
 * cheaper than hundreds of 3D polygons, so scrubbing through the centuries
 * stays smooth.
 *
 * From the bottom up: land with no record, in a faint grey so that it reads
 * as "nothing known" rather than as missing; territories carried over from
 * earlier maps, slightly paler; the map's own territories; names.
 */
export function paintMap(canvas, view) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  const x = (lng) => ((lng + 180) / 360) * width;
  const y = (lat) => ((90 - lat) / 180) * height;
  ctx.clearRect(0, 0, width, height);
  ctx.lineJoin = 'round';

  trace(ctx, view.blank, x, y);
  ctx.fillStyle = 'rgba(200, 208, 224, 0.13)';
  ctx.fill('evenodd');

  const carried = view.carried ?? [];
  if (carried.length && view.blank.length) {
    if (!scratch || scratch.width !== width) scratch = Object.assign(document.createElement('canvas'), { width, height });
    const under = scratch.getContext('2d');
    under.clearRect(0, 0, width, height);
    under.lineJoin = 'round';
    // Oldest first, each newer map replacing what it covers.
    for (const earlier of [...carried].reverse()) colour(under, earlier.named, x, y, width, true);
    // Keep only what falls on this map's blank land.
    trace(under, view.blank, x, y);
    under.globalCompositeOperation = 'destination-in';
    under.fillStyle = '#000';
    under.fill('evenodd');
    under.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 0.8;
    ctx.drawImage(scratch, 0, 0);
    ctx.globalAlpha = 1;
  }

  // Additions (first in the list) are painted last, replacing what they cover.
  colour(ctx, view.named.filter((t) => !t.added), x, y, width, false);
  colour(ctx, view.named.filter((t) => t.added), x, y, width, true);

  // Name the territories, biggest first. A name is skipped when it would not
  // fit inside its territory or would run into one already written. Carried
  // territories are named only if their label falls on the part that shows.
  const candidates = [
    ...view.named,
    ...carried.flatMap((earlier) => earlier.named.filter((t) => territoryAt(view, t.label)?.name === t.name)),
  ];
  const pixelsPerDegree = width / 360;
  const written = [];
  const named = new Set();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const territory of candidates.sort((a, b) => b.area - a.area)) {
    const { lat, lng } = territory.label;
    if (territory.area < 6 || named.has(territory.name) || Math.abs(lat) > 76) continue;

    // Text gets squeezed towards the poles when wrapped on a sphere: pre-stretch it.
    const stretch = 1 / Math.cos((lat * Math.PI) / 180);
    let size = Math.max(11, Math.min(34, 7 + Math.sqrt(territory.area) * 1.6)) * (width / 4096);
    ctx.font = `600 ${size}px Inter, "Segoe UI", system-ui, sans-serif`;
    const room = (territory.box[2] - territory.box[0]) * pixelsPerDegree * 1.15;
    const natural = ctx.measureText(territory.name).width * stretch;
    if (natural > room) size *= room / natural;
    if (size < 10 * (width / 4096)) continue;
    ctx.font = `600 ${size}px Inter, "Segoe UI", system-ui, sans-serif`;

    const halfWidth = (ctx.measureText(territory.name).width * stretch) / 2 + size * 0.4;
    const halfHeight = size * 0.75;
    const cx = x(lng);
    const cy = y(lat);
    const collides = written.some(
      (box) => Math.abs(box.cx - cx) < box.halfWidth + halfWidth && Math.abs(box.cy - cy) < box.halfHeight + halfHeight,
    );
    if (collides) continue;
    written.push({ cx, cy, halfWidth, halfHeight });
    named.add(territory.name);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(stretch, 1);
    ctx.lineWidth = size / 4;
    ctx.strokeStyle = 'rgba(4, 8, 18, 0.85)';
    ctx.strokeText(territory.name, 0, 0);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.fillText(territory.name, 0, 0);
    ctx.restore();
  }
}
