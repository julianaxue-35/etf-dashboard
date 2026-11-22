// Pure helpers, shared by the page and the tests.

export async function sha256Hex(text) {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// NOTE: client-side passcode = a deterrent for casual visitors only, NOT real security.
// The page holds only public market data; personal inputs never leave the browser.
export async function checkPasscode(input, hash) {
  if (!input) return false;
  return (await sha256Hex(input)) === hash;
}

export function isStale(meta, now = new Date(), days = 3) {
  if (!meta || !meta.updated_utc) return true;
  const t = Date.parse(meta.updated_utc.endsWith('Z') ? meta.updated_utc : meta.updated_utc + 'Z');
  if (Number.isNaN(t)) return true;
  return (now.getTime() - t) / 86400000 > days;
}

export function makeStore(storage) {
  return {
    get(key, dflt) {
      try {
        const v = storage.getItem(key);
        return v === null || v === undefined ? dflt : JSON.parse(v);
      } catch { return dflt; }
    },
    set(key, value) {
      try { storage.setItem(key, JSON.stringify(value)); } catch { /* storage blocked: page still works */ }
    },
  };
}

// Funds whose latest price is older than `days` (a failing ticker can go stale while the rest refresh).
export function staleTickers(metrics, now = new Date(), days = 5) {
  return Object.entries(metrics || {}).filter(([, m]) => {
    const t = m && m.last_date ? Date.parse(m.last_date) : NaN;
    return Number.isNaN(t) || (now.getTime() - t) / 86400000 > days;
  }).map(([k]) => k);
}
