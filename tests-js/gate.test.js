import test from 'node:test';
import assert from 'node:assert/strict';
import { checkPasscode, sha256Hex, isStale, makeStore } from '../js/core.js';

test('checkPasscode true only for right passcode', async () => {
  const h = await sha256Hex('open-sesame');
  assert.equal(await checkPasscode('open-sesame', h), true);
  assert.equal(await checkPasscode('wrong', h), false);
  assert.equal(await checkPasscode('', h), false);
});

test('isStale', () => {
  const now = new Date('2026-11-22T00:00:00Z');
  assert.equal(isStale({ updated_utc: '2026-11-18T00:00:00Z' }, now), true);
  assert.equal(isStale({ updated_utc: '2026-11-20T12:00:00Z' }, now), false);
  assert.equal(isStale({}, now), true);          // never updated = stale
  assert.equal(isStale(null, now), true);
});

test('store returns default when storage throws', () => {
  const bad = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  const s = makeStore(bad);
  assert.equal(s.get('k', 42), 42);
  assert.doesNotThrow(() => s.set('k', 1));
  const mem = new Map();
  const ok = makeStore({ getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) });
  ok.set('k', { a: 1 });
  assert.deepEqual(ok.get('k', null), { a: 1 });
});
