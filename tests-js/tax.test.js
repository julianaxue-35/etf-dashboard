import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { incomeTax, cgtOnSale, afterTaxOutcome, superOutcome } from '../js/tax.js';

const R = JSON.parse(fs.readFileSync(new URL('../config/tax.json', import.meta.url)));
const close = (a, b, tol = 1) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test('incomeTax brackets + Medicare', () => {
  assert.equal(incomeTax(0, R), 0);
  assert.equal(incomeTax(18200, R), 0);
  close(incomeTax(60000, R), 9720, 0.01);           // 4020 + 4500 + 1200 Medicare
  close(incomeTax(30000, R), 1968.9, 0.01);          // 1770 + Medicare phase-in 198.9
  close(incomeTax(1000000, R), 0.45 * (1000000 - 190000) + 0.37 * 55000 + 0.30 * 90000 + 0.15 * 26800 + 20000, 0.01);
});

test('cgtOnSale: discount, loss, no discount under 12 months', () => {
  assert.equal(cgtOnSale({ gain: 10000, heldMonths: 24, otherIncome: 0 }, R), 0);   // 5000 taxable, below threshold
  assert.equal(cgtOnSale({ gain: -5000, heldMonths: 24, otherIncome: 80000 }, R), 0);
  close(cgtOnSale({ gain: 10000, heldMonths: 6, otherIncome: 100000 }, R), 3200, 0.01);   // 32% marginal incl Medicare, no discount
  close(cgtOnSale({ gain: 10000, heldMonths: 12, otherIncome: 100000 }, R), 1600, 0.01);  // discounted at exactly 12 months
  close(cgtOnSale({ gain: 10000, heldMonths: 11, otherIncome: 100000 }, R), 3200, 0.01);
});

test('cgtOnSale proposed indexation rule', () => {
  const t = cgtOnSale({ gain: 10000, heldMonths: 120, otherIncome: 100000, costBase: 20000, cgtRule: 'indexed', cpi: 0.025 }, R);
  close(t, (10000 - 20000 * (Math.pow(1.025, 10) - 1)) * 0.32, 0.5);
  assert.equal(cgtOnSale({ gain: 1000, heldMonths: 120, otherIncome: 100000, costBase: 20000, cgtRule: 'indexed', cpi: 0.025 }, R), 0); // inflation wipes out gain, never negative
});

test('afterTaxOutcome growth-only, zero income', () => {
  const o = afterTaxOutcome({ principal: 20000, annualReturn: 0.09, years: 10, yieldPct: 0, frankingPct: 0, otherIncome: 0 }, R);
  close(o.gross, 47347, 1);
  assert.equal(o.cgt, 0);
  close(o.net, o.gross, 1);
});

test('afterTaxOutcome one year with franked distributions', () => {
  const o = afterTaxOutcome({ principal: 100000, annualReturn: 0.04, years: 1, yieldPct: 0.04, frankingPct: 1, otherIncome: 100000 }, R);
  close(o.tax_on_distributions, 114.29, 0.05);
  close(o.net, 103885.71, 0.05);
  close(o.gross, 104000, 0.01);
});

test('afterTaxOutcome edge cases never NaN', () => {
  const z = afterTaxOutcome({ principal: 0, annualReturn: 0.09, years: 10, yieldPct: 0.03, frankingPct: 0.5, otherIncome: 50000 }, R);
  assert.equal(z.net, 0);
  const big = afterTaxOutcome({ principal: 20000, annualReturn: 0.09, years: 10, yieldPct: 0.03, frankingPct: 0.5, otherIncome: 5000000 }, R);
  assert.ok(Number.isFinite(big.net) && big.net < big.gross);
  assert.throws(() => afterTaxOutcome({ principal: 1000, annualReturn: 0.09, years: 0, yieldPct: 0, frankingPct: 0, otherIncome: 0 }, R), /years/i);
  assert.throws(() => afterTaxOutcome({ principal: -1, annualReturn: 0.09, years: 5, yieldPct: 0, frankingPct: 0, otherIncome: 0 }, R), /negative/i);
});

test('negative return gives loss, zero tax on sale', () => {
  const o = afterTaxOutcome({ principal: 20000, annualReturn: -0.05, years: 5, yieldPct: 0, frankingPct: 0, otherIncome: 90000 }, R);
  assert.equal(o.cgt, 0);
  assert.ok(o.net < 20000);
});

test('superOutcome', () => {
  const s = superOutcome({ principal: 20000, annualReturn: 0.09, years: 10 }, R);
  close(s.net, 20000 * Math.pow(1 + 0.09 * 0.85, 10), 1);    // savings: no contributions tax
  assert.ok(s.net < s.gross);
  const pre = superOutcome({ principal: 20000, annualReturn: 0.09, years: 10, preTax: true }, R);
  close(pre.net, 17000 * Math.pow(1 + 0.09 * 0.85, 10), 1);  // pre-tax pay: 15% contributions tax
  assert.throws(() => superOutcome({ principal: 20000, annualReturn: 0.09, years: -1 }, R), /years/i);
});

test('selling in a low-income year cuts CGT (saleIncome)', () => {
  const base = { principal: 20000, annualReturn: 0.09, years: 10, yieldPct: 0, frankingPct: 0, otherIncome: 100000 };
  const working = afterTaxOutcome(base, R), retired = afterTaxOutcome({ ...base, saleIncome: 30000 }, R);
  assert.ok(retired.cgt < working.cgt);
  close(retired.cgt, 2725.6, 1);
  close(working.cgt, 4375.4, 1);
});

test('input validation: franking, yield, income, years cap', () => {
  const ok = { principal: 20000, annualReturn: 0.09, years: 10, yieldPct: 0.03, frankingPct: 0.5, otherIncome: 50000 };
  assert.throws(() => afterTaxOutcome({ ...ok, frankingPct: 5 }, R), /franked/i);
  assert.throws(() => afterTaxOutcome({ ...ok, frankingPct: -0.1 }, R), /franked/i);
  assert.throws(() => afterTaxOutcome({ ...ok, yieldPct: -0.02 }, R), /distribution/i);
  assert.throws(() => afterTaxOutcome({ ...ok, otherIncome: -1 }, R), /income/i);
  assert.throws(() => afterTaxOutcome({ ...ok, saleIncome: -1 }, R), /income/i);
  assert.throws(() => afterTaxOutcome({ ...ok, years: 100000 }, R), /100 or fewer/i);
  assert.doesNotThrow(() => afterTaxOutcome({ ...ok, years: 100 }, R));
  assert.throws(() => superOutcome({ principal: 1, annualReturn: 0.05, years: 1000 }, R), /100 or fewer/i);
});
