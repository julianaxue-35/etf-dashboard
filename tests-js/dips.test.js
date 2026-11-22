import test from 'node:test';
import assert from 'node:assert/strict';
import { dipStatus, tranches, peakPrice, levelPrices } from '../js/dips.js';

const L = [-0.15, -0.25, -0.35];

test('dipStatus hit and next', () => {
  assert.deepEqual(dipStatus(-0.27, L), { hit: [-0.15, -0.25], next: -0.35 });
  assert.deepEqual(dipStatus(0, L), { hit: [], next: -0.15 });
  assert.deepEqual(dipStatus(-0.5, L), { hit: L, next: null });
  assert.deepEqual(dipStatus(-0.15, L).hit, [-0.15]);       // exactly at level counts
});

test('dipStatus sorts unsorted levels and tolerates bad input', () => {
  assert.deepEqual(dipStatus(-0.2, [-0.35, -0.15, -0.25]), { hit: [-0.15], next: -0.25 });
  assert.deepEqual(dipStatus(0.03, L).hit, []);              // above peak = no dip
  assert.deepEqual(dipStatus(null, L), { hit: [], next: -0.15 });
  assert.deepEqual(dipStatus(-0.3, []), { hit: [], next: null });
});

test('tranches', () => {
  assert.deepEqual(tranches(10000, L), [3000, 3000, 4000]);
  assert.deepEqual(tranches(10000, [-0.2, -0.3]), [5000, 5000]);
  assert.deepEqual(tranches(10000, [-0.2, -0.3], [0.25, 0.75]), [2500, 7500]);
  assert.throws(() => tranches(10000, L, [0.5, 0.2, 0.2]), /add up to 100%/);
  assert.throws(() => tranches(10000, L, [0.5, 0.5]), /one share per level/);
  assert.deepEqual(tranches(0, L), [0, 0, 0]);
  assert.throws(() => tranches(-5, L), /negative/);
});

test('peakPrice and levelPrices', () => {
  assert.equal(peakPrice(90, -0.1), 100);
  assert.equal(peakPrice(100, 0), 100);
  assert.equal(peakPrice(null, -0.1), null);
  assert.deepEqual(levelPrices(100, L).map(x => +x.toFixed(2)), [85, 75, 65]);
});
