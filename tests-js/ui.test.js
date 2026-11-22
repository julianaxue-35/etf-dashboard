import test from 'node:test';
import assert from 'node:assert/strict';
import { trustBadge, riskAdjusted, trustLevel, fmtPct, esc } from '../js/ui.js';

test('riskAdjusted', () => {
  assert.equal(riskAdjusted(0.12, 0.12), 1);
  assert.equal(riskAdjusted(0.1, 0), null);
  assert.equal(riskAdjusted(null, 0.1), null);
  assert.equal(riskAdjusted(0.1, null), null);
});

test('trustLevel bands', () => {
  assert.equal(trustLevel(100), 'High');
  assert.equal(trustLevel(85), 'High');
  assert.equal(trustLevel(70), 'Medium');
  assert.equal(trustLevel(59), 'Low');
});

test('trustBadge 100 has no reasons, 70 lists them', () => {
  const full = trustBadge({ score: 100, reasons: [], source: 'ASX' });
  assert.match(full, /100/);
  assert.doesNotMatch(full, /<li>/);
  const mid = trustBadge({ score: 70, reasons: ['Unofficial feed.', 'Not cross-checked.'], source: 'Yahoo' });
  assert.match(mid, /Medium/);
  assert.match(mid, /Unofficial feed\./);
  assert.match(mid, /Not cross-checked\./);
});

test('trustBadge escapes html and tolerates missing entry', () => {
  assert.match(trustBadge({ score: 50, reasons: ['<b>x</b>'], source: '<i>' }), /&lt;b&gt;x&lt;\/b&gt;/);
  assert.match(trustBadge(null), /No source/);
});

test('fmtPct', () => {
  assert.equal(fmtPct(0.1234), '12.3%');
  assert.equal(fmtPct(null), '–');
  assert.equal(fmtPct(-0.05, 0), '-5%');
});

test('esc', () => { assert.equal(esc('<&>"'), '&lt;&amp;&gt;&quot;'); });

import { priceBadge, feeLabel } from '../js/ui.js';

test('priceBadge uses the selected ticker, not a fixed one', () => {
  const trust = { A200: { price: { score: 67, reasons: [], source: 'Yahoo' } },
                  NDQ: { price: { score: 40, reasons: ['Price differs from the ASX figure by 2.0%.'], source: 'Yahoo' } } };
  assert.match(priceBadge(trust, 'NDQ'), /Low 40/);
  assert.match(priceBadge(trust, 'NDQ'), /differs from the ASX/);
  assert.match(priceBadge(trust, 'A200'), /Medium 67/);
  assert.match(priceBadge(trust, 'ZZZ'), /No source/);
});

test('feeLabel marks fees read via search summary', () => {
  assert.equal(feeLabel({ category: 'core', fee_pct: 0.04, fee_check: 'issuer_page' }), '0.04%');
  assert.equal(feeLabel({ category: 'core', fee_pct: 0.07, fee_check: 'issuer_page_via_search' }), '0.07%†');
  assert.equal(feeLabel({ category: 'reference', fee_pct: 0, fee_check: 'n/a' }), '–');
  assert.equal(feeLabel({ category: 'core', fee_pct: 0.2, fee_check: 'unverified' }), '0.20%?');
});
