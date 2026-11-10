// The distance slider covers 17 orders of magnitude, from the Moon to the edge
// of the observable past. A plain logarithmic scale would squeeze all of human
// history into a sliver, so the scale is logarithmic in pieces, with half of
// the track given to the range where history happens.

const LIGHT_SECOND = 1 / (365.25 * 86400); // in light-years

export const MIN_LY = 1.2 * LIGHT_SECOND;
export const MAX_LY = 14e9;

// [slider position 0…1, log10(light-years)]
const STOPS = [
  [0.0, Math.log10(MIN_LY)],
  [0.12, 0], // 1 light-year
  [0.62, Math.log10(12000)], // end of recorded history and the last ice age
  [0.8, Math.log10(3e6)], // first humans
  [1.0, Math.log10(MAX_LY)],
];

function interpolate(value, from, to) {
  const last = STOPS.length - 1;
  if (value <= STOPS[0][from]) return STOPS[0][to];
  if (value >= STOPS[last][from]) return STOPS[last][to];
  for (let i = 1; i <= last; i++) {
    if (value <= STOPS[i][from]) {
      const a = STOPS[i - 1];
      const b = STOPS[i];
      return a[to] + ((value - a[from]) / (b[from] - a[from])) * (b[to] - a[to]);
    }
  }
  return STOPS[last][to];
}

export const lyFromSlider = (position) => 10 ** interpolate(position, 0, 1);
export const sliderFromLy = (ly) => interpolate(Math.log10(Math.max(ly, MIN_LY)), 1, 0);
export const clampLy = (ly) => Math.min(MAX_LY, Math.max(MIN_LY, ly));
