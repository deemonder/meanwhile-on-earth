// Outlines (rings of [longitude, latitude] points) made small enough to ship.
// The build scripts simplify and pack them; the app unpacks them.

/** Area of a ring in square degrees. */
export function ringArea(ring) {
  let twice = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    twice += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  }
  return Math.abs(twice) / 2;
}

/** Douglas–Peucker: keeps only the points that shape the outline, to within `tolerance` degrees. */
export function simplify(points, tolerance) {
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

/** Packs a ring as [x0, y0, dx1, dy1, …] in tenths of a degree. */
export function pack(ring) {
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

/** Undoes `pack`. The result also carries its bounding `box`: [west, south, east, north]. */
export function unpack(packed) {
  const points = [];
  let x = 0;
  let y = 0;
  let west = 180, south = 90, east = -180, north = -90;
  for (let i = 0; i < packed.length; i += 2) {
    x += packed[i];
    y += packed[i + 1];
    const lng = x / 10;
    const lat = y / 10;
    points.push([lng, lat]);
    if (lng < west) west = lng;
    if (lng > east) east = lng;
    if (lat < south) south = lat;
    if (lat > north) north = lat;
  }
  points.box = [west, south, east, north];
  return points;
}
