// Pure helpers for the News tab.
export function safeUrl(u) {
  try { const p = new URL(u); return p.protocol === 'https:' || p.protocol === 'http:' ? u : '#'; } catch { return '#'; }
}

export function timeAgo(iso, now = new Date()) {
  const t = Date.parse(iso || '');
  if (Number.isNaN(t)) return '';
  const mins = Math.floor((now.getTime() - t) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d === 1 ? '' : 's'} ago`;
}

export function filterNews(items, { ticker = 'all', topic = 'all' } = {}) {
  return (items || []).filter(i => (ticker === 'all' || (i.tickers || []).includes(ticker)) && (topic === 'all' || (i.topics || []).includes(topic)));
}

export function affectsLabel(tickers, totalFunds) {
  if (!tickers || !tickers.length) return '';
  if (tickers.length >= totalFunds * 0.8) return 'Most funds';
  return tickers.length <= 4 ? tickers.join(', ') : tickers.slice(0, 4).join(', ') + ` +${tickers.length - 4} more`;
}

export function toneSummary(items) {
  const out = { negative: 0, positive: 0, neutral: 0, total: 0 };
  for (const i of items || []) { out[i.tone in out ? i.tone : 'neutral']++; out.total++; }
  return out;
}

// Stories tagged to (almost) every fund say something about the whole market, not about one fund.
export function specificNews(items, totalFunds, share = 0.8) {
  return (items || []).filter(i => (i.tickers || []).length < totalFunds * share);
}
