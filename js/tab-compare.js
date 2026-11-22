import { scatterChart } from './charts.js';
import { trustBadge, priceBadge, feeLabel, fmtPct, riskAdjusted, esc } from './ui.js';

const NAMES = { core: 'Core', tech: 'Tech & AI', healthcare: 'Healthcare', infrastructure: 'Infrastructure', reference: 'Single stocks' };
const COLS = [['ticker', 'ETF'], ['category', 'Type'], ['fee_pct', 'Fee'], ['cagr_1y', '1y'], ['cagr_3y', '3y/yr'],
  ['volatility_3y', 'Volatility'], ['max_drawdown_3y', 'Worst fall'], ['drawdown_from_peak', 'Below peak'], ['ra', 'Return per risk'], ['trust', 'Trust']];

export function render(el, ctx) {
  const { metrics, etfs } = ctx;
  const rows = etfs.filter(e => metrics[e.ticker]).map(e => ({ ...e, ...metrics[e.ticker], ra: riskAdjusted(metrics[e.ticker].cagr_3y, metrics[e.ticker].volatility_3y), tr: ctx.trust[e.ticker]?.price }));
  const pts = rows.filter(r => r.cagr_3y !== null && r.volatility_3y).map(r => ({ label: r.ticker, x: r.volatility_3y * 100, y: r.cagr_3y * 100, group: NAMES[r.category] }));
  const groups = [...new Set(pts.map(p => p.group))];
  const feeFacts = Object.values(ctx.trust).map(t => t && t.facts).find(Boolean) || null;
  el.innerHTML = `
  <div class="takeaway">Higher up = better return. Further left = calmer ride. The shaded band is your 8–10% target.</div>
  <div class="card"><h2>Risk vs return (last 3 years)</h2><div class="chart" style="height:340px"><canvas id="sc" role="img" aria-label="Risk versus return scatter chart"></canvas></div>
  <div class="sub">Each fund's price source and trust score are in the table below.</div>
  <details class="more"><summary>More</summary>Return = 3-year compound average per year. Volatility = typical yearly swing. Funds under 3 years old are marked *.</details></div>
  <div class="card"><h2>Side by side</h2><div class="tablewrap"><table id="tbl"></table></div>
  <div class="sub">Tap a heading to sort. Tap a trust badge to see why it is below 100. Trust = the price source. Fees: from the issuer's own page (${trustBadge(feeFacts)}); † = checked from a search summary of that page, ? = not checked.</div></div>`;
  scatterChart(el.querySelector('#sc'), pts, groups, { riskFree: 6, targetLow: 8, targetHigh: 10 });
  let key = 'ra', dir = -1;
  const draw = () => {
    const v = r => key === 'trust' ? r.tr?.score ?? -1 : key === 'ticker' || key === 'category' ? r[key] : r[key] ?? -Infinity;
    const sorted = [...rows].sort((a, b) => (v(a) > v(b) ? 1 : -1) * dir);
    el.querySelector('#tbl').innerHTML = '<tr>' + COLS.map(([k, l]) => `<th data-k="${k}">${l}</th>`).join('') + '</tr>' + sorted.map(r => `<tr>
      <td><b>${esc(r.ticker)}</b>${r.limited_history ? '*' : ''}</td><td>${NAMES[r.category]}</td><td>${feeLabel(r)}</td>
      <td>${fmtPct(r.cagr_1y)}</td><td>${fmtPct(r.cagr_3y)}</td><td>${fmtPct(r.volatility_3y)}</td><td>${fmtPct(r.max_drawdown_3y, 0)}</td>
      <td>${fmtPct(r.drawdown_from_peak, 0)}</td><td>${r.ra === null ? '–' : r.ra.toFixed(2)}</td><td>${trustBadge(r.tr)}</td></tr>`).join('');
    el.querySelectorAll('th').forEach(th => th.onclick = () => { key === th.dataset.k ? dir *= -1 : (key = th.dataset.k, dir = -1); draw(); });
  };
  draw();
}
