// Picking the right reconstruction for an age.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DRIFT_AGES, OLDEST_KNOWN, driftAgeFor, onLand, polarIceEdge } from '../src/data/continents.js';

test('reconstructions cover 10 to 1,000 million years without repeats', () => {
  assert.equal(DRIFT_AGES[0], 10);
  assert.equal(DRIFT_AGES.at(-1), OLDEST_KNOWN / 1e6);
  assert.equal(new Set(DRIFT_AGES).size, DRIFT_AGES.length);
  assert.deepEqual([...DRIFT_AGES].sort((a, b) => a - b), DRIFT_AGES);
});

test('the nearest reconstruction is chosen', () => {
  assert.equal(driftAgeFor(2000), null); // recorded history: the real picture
  assert.equal(driftAgeFor(4e6), null);
  assert.equal(driftAgeFor(7e6), 10);
  assert.equal(driftAgeFor(66e6), 70);
  assert.equal(driftAgeFor(252e6), 250); // Pangaea
  assert.equal(driftAgeFor(590e6), 600);
  assert.equal(driftAgeFor(3e9), 1000); // older than the model: the oldest one
});

test('polar ice only in the ice ages', () => {
  assert.equal(polarIceEdge(20e6), 68);
  assert.equal(polarIceEdge(100e6), null); // Cretaceous hothouse
  assert.equal(polarIceEdge(300e6), 52); // late Paleozoic ice age
  assert.equal(polarIceEdge(445e6), 58);
  assert.equal(polarIceEdge(500e6), null);
});

test('a point is on land when inside an outline', () => {
  const square = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]];
  square.box = [0, 0, 10, 10];
  assert.equal(onLand([square], { lat: 5, lng: 5 }), true);
  assert.equal(onLand([square], { lat: 15, lng: 5 }), false);
  assert.equal(onLand([square], { lat: 5, lng: -5 }), false);
});
