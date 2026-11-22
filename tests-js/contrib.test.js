import test from 'node:test';
import assert from 'node:assert/strict';
import { monthlyNeeded, balanceAt, dcaVsLump, rollingDca } from '../js/contrib.js';

const close = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test('monthlyNeeded: start already near goal', () => {
  const r = monthlyNeeded({ goal: 50000, startBalance: 20000, years: 10, annualReturn: 0.09 });
  assert.ok(r.value > 0 && r.value < 30, String(r.value));     // ~ $14
});

test('monthlyNeeded: $200k from $20k in 10y at 9% (annuity formula, monthly compounding of the effective annual rate)', () => {
  const r = monthlyNeeded({ goal: 200000, startBalance: 20000, years: 10, annualReturn: 0.09 });
  const rm = Math.pow(1.09, 1 / 12) - 1, n = 120;
  const expected = (200000 - 20000 * Math.pow(1 + rm, n)) * rm / (Math.pow(1 + rm, n) - 1);
  close(r.value, expected, 0.01);
  close(r.value, 805, 5);
});

test('monthlyNeeded: 0 when start already reaches goal, reason when years<=0', () => {
  assert.equal(monthlyNeeded({ goal: 30000, startBalance: 50000, years: 10, annualReturn: 0.06 }).value, 0);
  const bad = monthlyNeeded({ goal: 50000, startBalance: 0, years: 0, annualReturn: 0.06 });
  assert.equal(bad.value, null); assert.match(bad.reason, /years/i);
  assert.equal(monthlyNeeded({ goal: 50000, startBalance: 0, years: 5, annualReturn: -1 }).value, null);
  assert.equal(monthlyNeeded({ goal: -5, startBalance: 0, years: 5, annualReturn: 0.05 }).value, null);
});

test('monthlyNeeded: zero return is straight-line', () => {
  close(monthlyNeeded({ goal: 12000, startBalance: 0, years: 1, annualReturn: 0 }).value, 1000, 0.001);
});

test('balanceAt reaches the goal at the end', () => {
  const p = { goal: 100000, startBalance: 10000, years: 8, annualReturn: 0.08 };
  const pmt = monthlyNeeded(p).value;
  close(balanceAt({ startBalance: 10000, monthly: pmt, annualReturn: 0.08, months: 96 }), 100000, 0.5);
});

test('dcaVsLump', () => {
  const up = Array.from({ length: 53 }, (_, i) => 100 + i);
  const r = dcaVsLump(up, 12);
  assert.ok(r.lump >= r.dca);
  const down = Array.from({ length: 53 }, (_, i) => 200 - i);
  assert.ok(dcaVsLump(down, 12).dca >= dcaVsLump(down, 12).lump);
  const flat = dcaVsLump(Array(53).fill(100), 12);
  close(flat.lump, 1, 1e-9); close(flat.dca, 1, 1e-9);
  assert.equal(dcaVsLump([100], 12), null);
});

test('rollingDca summarises many windows', () => {
  const up = Array.from({ length: 200 }, (_, i) => 100 * Math.pow(1.002, i));
  const s = rollingDca(up, 12);
  assert.ok(s.windows > 100);
  assert.equal(s.dcaWinRate, 0);                                  // steadily rising: lump always wins
  assert.ok(s.medianDiff > 0);
  assert.equal(rollingDca(up.slice(0, 10), 12), null);             // too short
});

test('rollingDca reports typical final value of each approach per $1', () => {
  const up = Array.from({ length: 200 }, (_, i) => 100 * Math.pow(1.002, i));
  const s = rollingDca(up, 12);
  assert.ok(s.medianLump > s.medianDca && s.medianDca > 1);
  const flat = rollingDca(Array(200).fill(100), 12);
  close(flat.medianLump, 1, 1e-9); close(flat.medianDca, 1, 1e-9);
});

test('monthlyNeeded caps years', () => {
  const r = monthlyNeeded({ goal: 1000, startBalance: 0, years: 100000, annualReturn: 0.05 });
  assert.equal(r.value, null); assert.match(r.reason, /100 or fewer/i);
});
