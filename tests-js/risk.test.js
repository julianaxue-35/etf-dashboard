import test from 'node:test';
import assert from 'node:assert/strict';
import { gainNeeded, recoveryYears, afterFall, lossLabel, fmtDays } from '../js/risk.js';

const close = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test('gainNeeded: a fall needs a bigger gain to recover', () => {
  close(gainNeeded(0.30), 0.4286, 0.0001);
  close(gainNeeded(0.50), 1.0, 1e-9);
  assert.throws(() => gainNeeded(0), /between/i);
  assert.throws(() => gainNeeded(1), /between/i);
  assert.throws(() => gainNeeded(-0.2), /between/i);
});

test('recoveryYears', () => {
  close(recoveryYears(0.30, 0.09), Math.log(1 / 0.7) / Math.log(1.09), 1e-9);   // ~4.1 years
  assert.equal(recoveryYears(0.30, 0), null);          // zero or negative return never recovers
  assert.equal(recoveryYears(0.30, -0.02), null);
});

test('afterFall', () => {
  assert.equal(afterFall(20000, 0.30), 14000);
  assert.equal(afterFall(0, 0.30), 0);
  assert.throws(() => afterFall(-1, 0.3), /negative/i);
});

test('lossLabel never says 0% (history is a short, mostly rising sample)', () => {
  assert.equal(lossLabel(0), 'under 1%');
  assert.equal(lossLabel(0.004), 'under 1%');
  assert.equal(lossLabel(0.044), '4%');
  assert.equal(lossLabel(0.5), '50%');
  assert.equal(lossLabel(null), '–');
});

test('fmtDays', () => {
  assert.equal(fmtDays(0), 'none');
  assert.equal(fmtDays(20), 'under a month');
  assert.equal(fmtDays(396), 'about 1 yr 1 mo');
  assert.equal(fmtDays(2466), 'about 6 yrs 9 mo');
  assert.equal(fmtDays(null), '–');
});
