import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fundSignal, prosCons } from '../js/signal.js';

const R = JSON.parse(fs.readFileSync(new URL('../config/signal_rules.json', import.meta.url)));
const NOW = new Date('2026-11-22T00:00:00Z');
const m = (o = {}) => ({ drawdown_from_peak: -0.02, ma200_gap: 0.02, ret_12m: 0.08, last_date: '2026-11-20', cagr_3y: 0.10, volatility_3y: 0.12, max_drawdown_3y: -0.13, history_years: 8, ...o });
const base = (o = {}) => ({ ticker: 'A200', etf: { ticker: 'A200', category: 'core', fee_pct: 0.04, region: 'au', name: 'x' }, metrics: m(), dividends: { ttm_yield: 0.035, franking: { value: 0.71 }, years_cut: 0, worst_yoy_change: -0.05 }, holdings: { top10_pct: 0.2, top_sector: { name: 'financial_services', pct: 0.3 } }, news: [], now: NOW, dipLevels: [-0.15, -0.25, -0.35], trustPrice: { crosscheck: true }, ...o });

test('Keep by default', () => {
  const s = fundSignal(base(), R);
  assert.equal(s.level, 'Keep'); assert.ok(s.reasons.length >= 1);
});

test('Watch triggers', () => {
  assert.equal(fundSignal(base({ metrics: m({ drawdown_from_peak: -0.16 }) }), R).level, 'Watch');
  assert.equal(fundSignal(base({ metrics: m({ ma200_gap: -0.06 }) }), R).level, 'Watch');
  assert.equal(fundSignal(base({ metrics: m({ ret_12m: -0.01 }) }), R).level, 'Watch');
  const neg = Array.from({ length: 5 }, () => ({ tickers: ['A200'], tone: 'negative' }));
  const s = fundSignal(base({ news: neg }), R);
  assert.equal(s.level, 'Watch'); assert.ok(s.reasons.some(r => /negative stories/i.test(r)));
  assert.equal(fundSignal(base({ news: neg.map(n => ({ ...n, tickers: ['NDQ'] })) }), R).level, 'Keep');   // other fund's news ignored
});

test('Review needs deep fall AND weak trend AND negative year', () => {
  assert.equal(fundSignal(base({ metrics: m({ drawdown_from_peak: -0.35, ma200_gap: -0.10, ret_12m: -0.2 }) }), R).level, 'Review');
  assert.equal(fundSignal(base({ metrics: m({ drawdown_from_peak: -0.35, ma200_gap: 0.05, ret_12m: 0.1 }) }), R).level, 'Watch');   // deep but recovering
});

test('stale or mismatched data flags Watch with a data reason', () => {
  const s = fundSignal(base({ metrics: m({ last_date: '2026-11-01' }) }), R);
  assert.equal(s.level, 'Watch'); assert.ok(s.reasons.some(r => /days old/i.test(r)));
  assert.equal(fundSignal(base({ trustPrice: { crosscheck: false } }), R).level, 'Watch');
});

test('dip levels reported separately and missing data does not throw', () => {
  const s = fundSignal(base({ metrics: m({ drawdown_from_peak: -0.27 }) }), R);
  assert.deepEqual(s.dip.hit, [-0.15, -0.25]);
  assert.equal(fundSignal(base({ metrics: null }), R).level, 'Unknown');
  assert.equal(fundSignal({ ticker: 'X' }, R).level, 'Unknown');
  assert.doesNotThrow(() => fundSignal(base({ news: null, holdings: null, dividends: null }), R));
});

test('prosCons for a low-fee diversified franked fund', () => {
  const pc = prosCons(base({ holdings: { top10_pct: 0.2, top_sector: { name: 'x', pct: 0.2 } } }), R);
  assert.ok(pc.pros.some(p => /low fee/i.test(p)));
  assert.ok(pc.pros.some(p => /franked/i.test(p)));
  assert.ok(pc.pros.some(p => /spread|diversif/i.test(p)));
  assert.ok(pc.pros.concat(pc.cons).every(t => t.split(/\s+/).length <= 30));
});

test('prosCons for a concentrated, pricey, volatile, unhedged fund', () => {
  const pc = prosCons(base({ ticker: 'SEMI', etf: { ticker: 'SEMI', category: 'tech', fee_pct: 0.57, region: 'global', name: 'Semis' },
    metrics: m({ volatility_3y: 0.36, max_drawdown_3y: -0.34, cagr_3y: 0.05, history_years: 2 }),
    dividends: { ttm_yield: 0.001, franking: { value: 0 }, years_cut: 3 }, holdings: { top10_pct: 0.76, top_sector: { name: 'technology', pct: 1 } } }), R);
  const c = pc.cons.join(' | ');
  for (const re of [/fee/i, /top 10/i, /technology/i, /swings|volatil/i, /fell/i, /currency/i, /franking/i, /under 3 years|short/i, /below.*savings|savings/i]) assert.match(c, re);
});

test('prosCons handles feeder/incomplete holdings and missing data', () => {
  const feeder = prosCons(base({ holdings: { feeder: true, top10_pct: null, underlying: 'iShares Core S&P 500 ETF', top_sector: { name: 'technology', pct: 0.3 } } }), R);
  assert.ok(feeder.pros.concat(feeder.cons).every(t => !/NaN|null|undefined/.test(t)));
  const none = prosCons({ ticker: 'X', etf: { ticker: 'X', category: 'core', fee_pct: 0.1, region: 'au' } }, R);
  assert.ok(Array.isArray(none.pros) && Array.isArray(none.cons));
});
