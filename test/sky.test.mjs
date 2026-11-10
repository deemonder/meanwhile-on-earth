// Checks the astronomy against worked examples from Meeus, "Astronomical
// Algorithms", and against a few facts any planetarium can confirm.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  J2000, calendarFromJd, decimalYear, deltaT, departureJd, jdFromUnix, mirrorNeeded, precess, sameHourDistance,
  separation, siderealTime, subObserverPoint, subsolarPoint, sunPosition, visibilityOverADay,
} from '../src/core/sky.js';
import { MAX_LY, MIN_LY, lyFromSlider, sliderFromLy } from '../src/core/scale.js';

const near = (actual, expected, tolerance, label) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: got ${actual}, expected ${expected} ± ${tolerance}`);

test('calendar dates from Julian Dates', () => {
  assert.deepEqual(calendarFromJd(J2000), { year: 2000, month: 1, day: 1, hour: 12, minute: 0, second: 0 });
  // Meeus 7.c
  assert.deepEqual(calendarFromJd(2436116.31), { year: 1957, month: 10, day: 4, hour: 19, minute: 26, second: 24 });
  const julian = calendarFromJd(1842713.0);
  assert.deepEqual([julian.year, julian.month, julian.day], [333, 1, 27]);
  const bc = calendarFromJd(1507900.13);
  assert.deepEqual([bc.year, bc.month, bc.day], [-584, 5, 28]);
  // JD 0 is noon on 1 January 4713 BC; the day before needs the negative-JD path.
  assert.deepEqual([calendarFromJd(0).year, calendarFromJd(0).month, calendarFromJd(0).day], [-4712, 1, 1]);
  const before = calendarFromJd(-1);
  assert.deepEqual([before.year, before.month, before.day], [-4713, 12, 31]);
});

test('light from 2,000 light-years away left in the early Roman Empire', () => {
  const now = jdFromUnix(Date.UTC(2026, 10, 10));
  const left = calendarFromJd(departureJd(2000, now));
  assert.equal(left.year, 26);
  near(decimalYear(departureJd(2000, now)), 26.86, 0.01, 'decimal year');
});

test('sidereal time (Meeus 12.a)', () => {
  near(siderealTime(2446895.5), 197.693195, 1e-5, 'GMST on 1987-04-10 0h UT');
});

test('position of the Sun (Meeus 25.a)', () => {
  const sun = sunPosition(2448908.5);
  near(sun.ra, 198.38083, 0.02, 'right ascension');
  near(sun.dec, -7.78507, 0.02, 'declination');
});

test('subsolar point: noon at Greenwich on an equinox', () => {
  // 20 March 2024, 12:00 UTC. The Sun is over the equator, about 1.9° east of
  // Greenwich because the equation of time is −7.5 minutes that day.
  const p = subsolarPoint(jdFromUnix(Date.UTC(2024, 2, 20, 12)));
  near(p.lat, 0.1, 0.3, 'latitude');
  near(p.lng, 1.9, 0.5, 'longitude');
});

test('precession moves the pole star', () => {
  // Meeus 21.b: θ Persei, J2000 → 13 November 2028.
  const persei = precess(41.054063, 49.22775, 2462088.69);
  near(persei.ra, 41.547214, 0.001, 'θ Persei RA');
  near(persei.dec, 49.348483, 0.001, 'θ Persei Dec');
  // Thuban was the pole star when the pyramids were built…
  const thuban = precess(211.097, 64.376, J2000 - 4800 * 365.25);
  assert.ok(thuban.dec > 89, `Thuban declination in 2800 BC: ${thuban.dec}`);
  // …and in Roman times Polaris was about 12° from the pole.
  const polaris = precess(37.955, 89.264, J2000 - 1974 * 365.25);
  near(polaris.dec, 78.3, 1, 'Polaris declination in AD 26');
});

test('ΔT grows quadratically into the past', () => {
  near(deltaT(2020), 69, 3, 'modern');
  near(deltaT(26), 10280, 50, 'Roman era'); // almost 3 hours of rotation
});

test('sub-observer point sits at the star’s declination and turns with Earth', () => {
  const vega = { ra: 279.235, dec: 38.784 };
  const jd = J2000;
  const a = subObserverPoint(vega, jd);
  const b = subObserverPoint(vega, jd + 0.25); // six hours later
  near(a.lat, 38.784, 0.01, 'latitude equals declination at J2000');
  near(separation({ lat: 0, lng: a.lng }, { lat: 0, lng: b.lng }), 90.25, 0.1, 'westward drift in 6 h');
});

test('what a given star can ever see', () => {
  assert.equal(visibilityOverADay(-41, 89), 'never'); // Polaris never sees Wellington
  assert.equal(visibilityOverADay(60, 80), 'always');
  assert.equal(visibilityOverADay(42, -29), 'sometimes');
});

test('telescope needed from 2,000 light-years', () => {
  // ~1.3 billion km, or 8.5 astronomical units.
  near(mirrorNeeded(2000) / 1.496e11, 8.5, 0.1, 'mirror diameter in AU');
});

test('slider scale is monotonic and reversible', () => {
  let previous = 0;
  for (let p = 0; p <= 1.0001; p += 0.01) {
    const ly = lyFromSlider(Math.min(p, 1));
    assert.ok(ly > previous);
    near(sliderFromLy(ly), Math.min(p, 1), 1e-9, `round trip at ${p.toFixed(2)}`);
    previous = ly;
  }
  near(lyFromSlider(0), MIN_LY, MIN_LY * 1e-9, 'lower end');
  near(lyFromSlider(1), MAX_LY, 1, 'upper end');
});

test('same-hour distances keep the Sun over the same place', () => {
  const now = jdFromUnix(Date.UTC(2026, 10, 10, 10, 30));
  const sunNow = subsolarPoint(now);
  for (const wanted of [1, 37.4, 500, 2000, 4586]) {
    const ly = sameHourDistance(wanted, now);
    near(ly, wanted, 0.6, `stays close to ${wanted} light-years`);
    const sunThen = subsolarPoint(departureJd(ly, now));
    // The Sun is overhead within a few degrees of where it is now: the same
    // time of day and season. (An arbitrary distance would land anywhere.)
    assert.ok(separation(sunThen, sunNow) < 6, `${wanted} ly: Sun moved ${separation(sunThen, sunNow).toFixed(1)}°`);
  }
  // Outside the range where rotation is known, distances pass through unchanged.
  assert.equal(sameHourDistance(0.5, now), 0.5);
  assert.equal(sameHourDistance(50000, now), 50000);
});
