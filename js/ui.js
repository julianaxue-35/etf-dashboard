// Small presentation helpers (pure, testable).
export const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function fmtPct(x, dp = 1) {
  return x === null || x === undefined || Number.isNaN(x) ? '–' : (x * 100).toFixed(dp) + '%';
}

export function riskAdjusted(cagr, vol) {
  if (cagr === null || cagr === undefined || !vol) return null;
  return cagr / vol;
}

export function trustLevel(score) {
  return score >= 85 ? 'High' : score >= 60 ? 'Medium' : 'Low';
}

// Colour AND a text label, so meaning never relies on colour alone.
export function trustBadge(entry) {
  if (!entry) return '<span class="sub">No source</span>';
  const lvl = trustLevel(entry.score);
  const cls = lvl === 'High' ? 'high' : lvl === 'Medium' ? 'med' : 'low';
  const why = entry.reasons && entry.reasons.length
    ? `<ul class="tight">${entry.reasons.map(r => `<li>${esc(r)}</li>`).join('')}</ul>` : '';
  return `<span class="trust"><button type="button" class="badge ${cls}" data-trust aria-expanded="false">`
    + `${lvl} ${entry.score}/100</button>`
    + `<span class="why sub" hidden>Source: ${esc(entry.source)}.${why}</span></span>`;
}
