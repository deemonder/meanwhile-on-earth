// The physics behind the what-if.
//
// An observer N light-years away sees light that left Earth N years ago. To
// know what that light shows we need three things about the moment it left:
//   1. the date                      → Julian Date arithmetic
//   2. where on Earth it was daytime → position of the Sun
//   3. which side faced the observer → Earth's rotation and the star's
//                                      coordinates, corrected for precession
//
// Formulas follow Jean Meeus, "Astronomical Algorithms" (2nd ed.). Times are
// Julian Dates so the maths keeps working billions of years back, far beyond
// what a JavaScript Date can hold.

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

export const J2000 = 2451545.0;
export const DAYS_PER_YEAR = 365.25; // the Julian year, which defines the light-year
export const SECONDS_PER_YEAR = DAYS_PER_YEAR * 86400;
export const METRES_PER_LIGHT_YEAR = 9.4607304725808e15;
export const AGE_OF_UNIVERSE = 13.787e9; // years

/** Beyond this many years Earth's rotation angle can no longer be reconstructed. */
export const ROTATION_KNOWN_FOR = 6000;

const wrap360 = (deg) => ((deg % 360) + 360) % 360;
const wrap180 = (deg) => wrap360(deg + 180) - 180;

export const jdFromUnix = (ms) => ms / 86400000 + 2440587.5;

/** Julian Date at which light now reaching `lightYears` away left Earth. */
export const departureJd = (lightYears, nowJd) => nowJd - lightYears * DAYS_PER_YEAR;

/** Decimal year, astronomical numbering (year 0 = 1 BC). */
export const decimalYear = (jd) => 2000 + (jd - J2000) / DAYS_PER_YEAR;

/**
 * Julian Date → calendar date. Uses the Julian calendar before 15 October 1582
 * and the Gregorian one after, as historians do. (Meeus ch. 7.)
 */
export function calendarFromJd(jd) {
  // The algorithm needs a positive JD: shift by whole 4-year Julian cycles.
  const cycles = jd < 0 ? Math.ceil(-jd / 1461) + 1 : 0;
  const shifted = jd + cycles * 1461;

  const z = Math.floor(shifted + 0.5);
  const dayFraction = shifted + 0.5 - z;
  let a = z;
  if (z >= 2299161) {
    const alpha = Math.floor((z - 1867216.25) / 36524.25);
    a = z + 1 + alpha - Math.floor(alpha / 4);
  }
  const b = a + 1524;
  const c = Math.floor((b - 122.1) / 365.25);
  const d = Math.floor(365.25 * c);
  const e = Math.floor((b - d) / 30.6001);

  const day = b - d - Math.floor(30.6001 * e);
  const month = e < 14 ? e - 1 : e - 13;
  const year = (month > 2 ? c - 4716 : c - 4715) - cycles * 4;
  const seconds = Math.round(dayFraction * 86400);
  return {
    year,
    month,
    day,
    hour: Math.floor(seconds / 3600) % 24,
    minute: Math.floor(seconds / 60) % 60,
    second: seconds % 60,
  };
}

/**
 * ΔT = TT − UT in seconds: how far Earth's rotation has drifted from a perfect
 * clock. Tides slow the planet down, so going back 2,000 years the ground was
 * about 43° of rotation away from where a constant spin would put it.
 * Before 1600: the Morrison & Stephenson (2004) parabola. After: measured values.
 */
export function deltaT(year) {
  if (year < 1600) {
    const u = (year - 1820) / 100;
    return -20 + 32 * u * u;
  }
  const table = [[1600, 120], [1700, 9], [1800, 14], [1900, -3], [1950, 29], [2000, 64], [2030, 70]];
  if (year >= 2030) return 70;
  for (let i = 1; i < table.length; i++) {
    const [y1, v1] = table[i];
    if (year <= y1) {
      const [y0, v0] = table[i - 1];
      return v0 + ((v1 - v0) * (year - y0)) / (y1 - y0);
    }
  }
  return 70;
}

/** Converts a uniform-time Julian Date (TT) into a rotation-based one (UT). */
export const utFromTt = (jdTt) => jdTt - deltaT(decimalYear(jdTt)) / 86400;

/**
 * The distance closest to `lightYears` whose light left Earth at the same
 * time of day and in the same season as the light leaving now.
 *
 * Moving the distance smoothly makes day and night flicker, because every
 * extra year of light travel is 365.25 days: a quarter turn of the planet.
 * Stepping through these distances instead keeps the Sun where it is, so a
 * trip through the centuries shows history changing, not the lighting.
 */
export function sameHourDistance(lightYears, nowJd) {
  if (lightYears < 1 || lightYears > ROTATION_KNOWN_FOR) return lightYears;
  const TROPICAL_YEAR = 365.2422; // days from one spring equinox to the next
  const years = Math.round((lightYears * DAYS_PER_YEAR) / TROPICAL_YEAR);
  const days = Math.round(years * TROPICAL_YEAR); // whole days: same clock time
  // Clock time is uniform but the planet's spin is not: add what the
  // slowdown amounts to between then and now.
  const slowdown = deltaT(decimalYear(nowJd - days)) - deltaT(decimalYear(nowJd));
  return (days - slowdown / 86400) / DAYS_PER_YEAR;
}

/** Greenwich Mean Sidereal Time in degrees: Earth's rotation angle. (Meeus 12.4) */
export function siderealTime(jdUt) {
  const d = jdUt - J2000;
  const t = d / 36525;
  return wrap360(280.46061837 + 360.98564736629 * d + 0.000387933 * t * t - (t * t * t) / 38710000);
}

/** Right ascension and declination of the Sun, degrees, equinox of date. (Meeus ch. 25) */
export function sunPosition(jdTt) {
  const t = (jdTt - J2000) / 36525;
  const meanLongitude = 280.46646 + 36000.76983 * t + 0.0003032 * t * t;
  const anomaly = (357.52911 + 35999.05029 * t - 0.0001537 * t * t) * RAD;
  const centre =
    (1.914602 - 0.004817 * t - 0.000014 * t * t) * Math.sin(anomaly) +
    (0.019993 - 0.000101 * t) * Math.sin(2 * anomaly) +
    0.000289 * Math.sin(3 * anomaly);
  const longitude = (meanLongitude + centre) * RAD;
  const tilt = (23.439291 - 0.0130042 * t) * RAD;
  return {
    ra: wrap360(Math.atan2(Math.cos(tilt) * Math.sin(longitude), Math.cos(longitude)) * DEG),
    dec: Math.asin(Math.sin(tilt) * Math.sin(longitude)) * DEG,
  };
}

/**
 * Moves J2000 star coordinates to the equinox of another date. Earth's axis
 * wobbles with a 26,000-year period, so the sky's coordinate grid slides:
 * in Roman times Polaris sat 12° away from the pole. (Meeus 21.2–21.4)
 */
export function precess(ra, dec, jdTt) {
  const t = (jdTt - J2000) / 36525;
  const arcsec = RAD / 3600;
  const zeta = (2306.2181 * t + 0.30188 * t * t + 0.017998 * t * t * t) * arcsec;
  const z = (2306.2181 * t + 1.09468 * t * t + 0.018203 * t * t * t) * arcsec;
  const theta = (2004.3109 * t - 0.42665 * t * t - 0.041833 * t * t * t) * arcsec;

  const a0 = ra * RAD + zeta;
  const d0 = dec * RAD;
  const a = Math.cos(d0) * Math.sin(a0);
  const b = Math.cos(theta) * Math.cos(d0) * Math.cos(a0) - Math.sin(theta) * Math.sin(d0);
  const c = Math.sin(theta) * Math.cos(d0) * Math.cos(a0) + Math.cos(theta) * Math.sin(d0);
  return {
    ra: wrap360((Math.atan2(a, b) + z) * DEG),
    dec: Math.asin(Math.max(-1, Math.min(1, c))) * DEG,
  };
}

/** The spot on Earth that has a given sky direction exactly overhead. */
const pointBeneath = ({ ra, dec }, jdUt) => ({ lat: dec, lng: wrap180(ra - siderealTime(jdUt)) });

/** Where the Sun is overhead: the centre of the daylight side. */
export const subsolarPoint = (jdTt) => pointBeneath(sunPosition(jdTt), utFromTt(jdTt));

/**
 * Where a star (J2000 coordinates) is overhead: the centre of the hemisphere
 * an observer at that star is looking at.
 */
export const subObserverPoint = (star, jdTt) =>
  pointBeneath(precess(star.ra, star.dec, jdTt), utFromTt(jdTt));

/** Great-circle angle between two { lat, lng } points, in degrees. */
export function separation(p, q) {
  const cos =
    Math.sin(p.lat * RAD) * Math.sin(q.lat * RAD) +
    Math.cos(p.lat * RAD) * Math.cos(q.lat * RAD) * Math.cos((p.lng - q.lng) * RAD);
  return Math.acos(Math.max(-1, Math.min(1, cos))) * DEG;
}

export const kmBetween = (p, q) => separation(p, q) * RAD * 6371;

/** 'day', 'twilight' or 'night' at a point, given where the Sun is overhead. */
export function daylight(point, subsolar) {
  const elevation = 90 - separation(point, subsolar);
  if (elevation > 0) return 'day';
  return elevation > -6 ? 'twilight' : 'night';
}

/**
 * Can an observer in the direction of declination `dec` ever see latitude `lat`?
 * As Earth turns, the spot under the star travels along the parallel at `dec`.
 */
export function visibilityOverADay(lat, dec) {
  if (Math.abs(lat - dec) > 90) return 'never';
  if (Math.abs(lat + dec) > 90) return 'always';
  return 'sometimes';
}

/**
 * Mirror diameter in metres needed to resolve details `detail` metres across
 * from `lightYears` away: the Rayleigh diffraction limit, θ = 1.22 λ / D,
 * for green light.
 */
export const mirrorNeeded = (lightYears, detail = 10, wavelength = 550e-9) =>
  (1.22 * wavelength * lightYears * METRES_PER_LIGHT_YEAR) / detail;
