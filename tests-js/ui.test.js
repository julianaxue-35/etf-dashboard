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
