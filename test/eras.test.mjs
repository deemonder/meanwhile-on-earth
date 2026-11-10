// Every moment in the past must map to exactly one sensible era.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ERAS, eraAt, hasEarth } from '../src/data/eras.js';
import { MAX_LY, MIN_LY } from '../src/core/scale.js';

test('known moments land in the right era', () => {
  const look = (age) => eraAt(age).look;
  assert.equal(look(MIN_LY), 'today');
  assert.equal(look(2000), 'today'); // classical antiquity
  assert.equal(look(21000), 'peakIce');
  assert.equal(eraAt(66e6).wiki.en, 'Chicxulub crater'); // a brief event wins over the era around it
  assert.equal(look(650e6), 'snowball');
  assert.equal(look(3e9), 'archean');
  assert.equal(look(4.3e9), 'molten');
  assert.equal(look(4.57e9), 'forming');
  assert.equal(look(10e9), 'cloud');
});

test('the far end of the slider is older than the Universe, not today', () => {
  assert.equal(eraAt(MAX_LY).look, 'void');
  assert.equal(eraAt(13.9e9).look, 'void');
  assert.ok(!hasEarth(eraAt(MAX_LY).look));
});

test('the eras leave no gaps', () => {
  // Sample the whole range logarithmically: each age must fall inside the era returned for it.
  for (let exponent = Math.log10(MIN_LY); exponent <= Math.log10(MAX_LY); exponent += 0.01) {
    const age = 10 ** exponent;
    const era = eraAt(age);
    assert.ok(age >= era.from && age < era.to, `no era contains ${age} years ago (got "${era.en[0]}")`);
  }
  assert.equal(ERAS.at(-1).to, Infinity);
});
