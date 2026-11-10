// Who ruled where, and when.
//
// Maps come from the "historical-basemaps" project by André Ourednik
// (https://github.com/aourednik/historical-basemaps, GPL-3.0): one GeoJSON
// world map for each of 53 dates between 123,000 BC and 2010. They are loaded
// from a CDN when needed rather than copied into this repository.

const SOURCES = [
  'https://cdn.jsdelivr.net/gh/aourednik/historical-basemaps@master/geojson/',
  'https://raw.githubusercontent.com/aourednik/historical-basemaps/master/geojson/',
];

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

/** The map closest in time to `year`, or null when none is relevant. */
export function mapFor(year) {
  if (year < OLDEST_YEAR) return null;
  return MAPS.reduce((best, map) => (Math.abs(map.year - year) < Math.abs(best.year - year) ? map : best));
}

const loaded = new Map();

/** Resolves to the list of named territories on a map. Results are cached. */
export function loadMap(map) {
  if (!loaded.has(map.file)) {
    const pending = download(`world_${map.file}.geojson`)
      .then((geojson) => geojson.features.filter((f) => f.geometry && f.properties?.NAME).map(toTerritory))
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

function toTerritory(feature) {
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
    name: NAME,
    overlord,
    hue: hueOf(overlord ?? NAME),
    polygons,
    box: [west, south, east, north],
    area,
    label: { lat: biggest.lat, lng: biggest.lng },
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

/** The territory containing a point, or null over sea and unclaimed land. */
export function territoryAt(territories, { lat, lng }) {
  for (const territory of territories) {
    const [west, south, east, north] = territory.box;
    if (lng < west || lng > east || lat < south || lat > north) continue;
    for (const [outline, ...holes] of territory.polygons) {
      if (ringContains(outline, lng, lat) && !holes.some((hole) => ringContains(hole, lng, lat))) {
        return territory;
      }
    }
  }
  return null;
}

/**
 * Paints the territories onto an equirectangular canvas (longitude across,
 * latitude down), which the globe then wraps around the planet. One texture
 * is far cheaper than hundreds of 3D polygons, so scrubbing through the
 * centuries stays smooth.
 */
export function paintMap(canvas, territories) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  const x = (lng) => ((lng + 180) / 360) * width;
  const y = (lat) => ((90 - lat) / 180) * height;
  ctx.clearRect(0, 0, width, height);
  ctx.lineJoin = 'round';

  for (const territory of territories) {
    ctx.beginPath();
    for (const rings of territory.polygons) {
      for (const ring of rings) {
        ring.forEach(([lng, lat], i) => (i ? ctx.lineTo(x(lng), y(lat)) : ctx.moveTo(x(lng), y(lat))));
        ctx.closePath();
      }
    }
    ctx.fillStyle = `hsla(${territory.hue}, 75%, 58%, 0.34)`;
    ctx.fill('evenodd');
    ctx.strokeStyle = `hsla(${territory.hue}, 85%, 78%, 0.9)`;
    ctx.lineWidth = width / 2048;
    ctx.stroke();
  }

  // Name the territories, biggest first. A name is skipped when it would not
  // fit inside its territory or would run into one already written.
  const pixelsPerDegree = width / 360;
  const written = [];
  const named = new Set();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const territory of [...territories].sort((a, b) => b.area - a.area)) {
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
