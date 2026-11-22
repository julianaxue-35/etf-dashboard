// Buy-the-dip helpers. Levels are negative fractions from the peak (e.g. -0.25 = 25% below peak).
export function dipStatus(drawdown, levels) {
  const sorted = [...levels].sort((a, b) => b - a);         // shallowest first
  const dd = typeof drawdown === 'number' && drawdown < 0 ? drawdown : 0;
  const hit = sorted.filter(l => dd <= l + 1e-12);
  const next = sorted.find(l => dd > l + 1e-12);
  return { hit, next: next === undefined ? null : next };
}

export function tranches(reserve, levels, split) {
  if (reserve < 0) throw new Error('Cash reserve cannot be negative.');
  const n = levels.length;
  let s = split;
  if (!s) s = n === 3 ? [0.3, 0.3, 0.4] : Array.from({ length: n }, () => 1 / n);
  if (s.length !== n) throw new Error('Need one share per level.');
  if (Math.abs(s.reduce((a, b) => a + b, 0) - 1) > 1e-9) throw new Error('Shares must add up to 100%.');
  const out = s.map(x => Math.round(reserve * x * 100) / 100);
  const diff = Math.round((reserve - out.reduce((a, b) => a + b, 0)) * 100) / 100;
  if (n) out[n - 1] = Math.round((out[n - 1] + diff) * 100) / 100;
  return out;
}

export function peakPrice(last, drawdown) {
  if (typeof last !== 'number' || typeof drawdown !== 'number') return null;
  return last / (1 + drawdown);
}

export function levelPrices(peak, levels) {
  return [...levels].sort((a, b) => b - a).map(l => peak * (1 + l));
}
