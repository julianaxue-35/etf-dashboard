import test from 'node:test';
import assert from 'node:assert/strict';
import { safeUrl, timeAgo, filterNews, affectsLabel, toneSummary } from '../js/news.js';

test('safeUrl only allows http(s)', () => {
  assert.equal(safeUrl('https://a.com/x'), 'https://a.com/x');
  assert.equal(safeUrl('http://a.com'), 'http://a.com');
  assert.equal(safeUrl('javascript:alert(1)'), '#');
  assert.equal(safeUrl('data:text/html,<b>'), '#');
  assert.equal(safeUrl(''), '#');
  assert.equal(safeUrl(null), '#');
});

test('timeAgo', () => {
  const now = new Date('2026-11-22T12:00:00Z');
  assert.equal(timeAgo('2026-11-22T11:58:00Z', now), '2 min ago');
  assert.equal(timeAgo('2026-11-22T09:00:00Z', now), '3 h ago');
  assert.equal(timeAgo('2026-11-20T12:00:00Z', now), '2 days ago');
  assert.equal(timeAgo('2026-11-22T12:00:30Z', now), 'just now');      // slight clock skew
  assert.equal(timeAgo('garbage', now), '');
  assert.equal(timeAgo(null, now), '');
});

const items = [
  { title: 'a', tickers: ['A200', 'VAS'], topics: ['au_market'], tone: 'negative' },
  { title: 'b', tickers: ['NDQ'], topics: ['tech_ai', 'selloff'], tone: 'negative' },
  { title: 'c', tickers: ['NDQ', 'A200'], topics: ['tech_ai'], tone: 'positive' }];

test('filterNews', () => {
  assert.equal(filterNews(items, { ticker: 'all', topic: 'all' }).length, 3);
  assert.deepEqual(filterNews(items, { ticker: 'NDQ', topic: 'all' }).map(i => i.title), ['b', 'c']);
  assert.deepEqual(filterNews(items, { ticker: 'A200', topic: 'tech_ai' }).map(i => i.title), ['c']);
  assert.deepEqual(filterNews(items, { ticker: 'ZZZ', topic: 'all' }), []);
  assert.deepEqual(filterNews(null, {}), []);
});

test('affectsLabel', () => {
  assert.equal(affectsLabel(['A200', 'VAS'], 13), 'A200, VAS');
  assert.equal(affectsLabel(Array.from({ length: 11 }, (_, i) => 'T' + i), 13), 'Most funds');
  assert.equal(affectsLabel(['A', 'B', 'C', 'D', 'E', 'F'], 13), 'A, B, C, D +2 more');
  assert.equal(affectsLabel([], 13), '');
});

test('toneSummary', () => {
  assert.deepEqual(toneSummary(items), { negative: 2, positive: 1, neutral: 0, total: 3 });
  assert.deepEqual(toneSummary([]), { negative: 0, positive: 0, neutral: 0, total: 0 });
});

import { specificNews } from '../js/news.js';

test('specificNews drops stories that apply to nearly every fund (reference stocks ignored in the count)', () => {
  const funds = Array.from({ length: 13 }, (_, i) => 'T' + i);
  const all = { title: 'selloff', tickers: [...funds.slice(0, 12), 'CSL', 'MQG'] };      // 12 funds + 2 stocks
  const few = { title: 'nvidia', tickers: ['T1', 'T2', 'CSL', 'MQG', 'TCL', 'APA'] };    // 2 funds + 4 stocks: must stay specific
  assert.deepEqual(specificNews([all, few], funds).map(i => i.title), ['nvidia']);
  assert.deepEqual(specificNews([all, few], funds, 0.99).map(i => i.title), ['selloff', 'nvidia']);
  assert.deepEqual(specificNews(null, funds), []);
});
