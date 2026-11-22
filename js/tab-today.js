import { barChart, lineChart, alignSeries } from './charts.js';
import { priceBadge, fmtPct, esc } from './ui.js';

const GROUPS = { core: 'Core (broad market)', tech: 'Technology & AI', healthcare: 'Healthcare', infrastructure: 'Infrastructure', reference: 'Single stocks (reference)' };

export function render(el, ctx) {
  const { metrics, etfs } = ctx;
  const live = etfs.filter(e => metrics[e.ticker]);
  const funds = live.filter(e => e.category !== 'reference');
  const rated = funds.filter(e => metrics[e.ticker].cagr_3y !== null && metrics[e.ticker].volatility_3y);
  const best = [...rated].sort((a, b) => metrics[b.ticker].cagr_3y / metrics[b.ticker].volatility_3y - metrics[a.ticker].cagr_3y / metrics[a.ticker].volatility_3y)[0];
  const deepest = [...funds].sort((a, b) => metrics[a.ticker].drawdown_from_peak - metrics[b.ticker].drawdown_from_peak)[0];
  el.innerHTML = `
  <div class="takeaway">${best ? `Best return for the risk over 3 years: ${esc(best.ticker)} (${fmtPct(metrics[best.ticker].cagr_3y)} a year). ` : ''}${deepest ? `Furthest below its peak now: ${esc(deepest.ticker)} (${fmtPct(metrics[deepest.ticker].drawdown_from_peak, 0)}).` : ''}</div>
  <div class="card"><h2>Growth of $100 over 3 years</h2>
    <label for="grp">Show</label><select id="grp">${Object.entries(GROUPS).filter(([k]) => live.some(e => e.category === k)).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
    <div class="chart"><canvas id="c1" role="img" aria-label="Growth of 100 dollars over 3 years"></canvas></div>
    <div class="sub" id="cap1"></div>
    <details class="more"><summary>More</summary>Prices include reinvested distributions. Weekly points. Past performance does not guarantee future results.</details></div>
  <div class="card"><h2>How far below the peak each fund is today</h2>
    <div class="chart" style="height:${Math.max(240, funds.length * 26)}px"><canvas id="c2" role="img" aria-label="Fall from 3-year peak by fund"></canvas></div>
    <div class="sub">Bigger bars = bigger fall. This feeds the Dips tab.</div></div>`;
  const grp = el.querySelector('#grp');
  const draw = () => {
    const sel = live.filter(e => e.category === grp.value);
    const { series } = alignSeries(sel.map(e => ({ label: e.ticker, dates: ctx.prices[e.ticker].d, prices: ctx.prices[e.ticker].p })));
    lineChart(el.querySelector('#c1'), series, 'Value of $100 invested (each fund starts at 100 on its first date)');
    el.querySelector('#cap1').innerHTML = 'Price sources: ' + sel.map(e => `${esc(e.ticker)} ${priceBadge(ctx.trust, e.ticker)}`).join(' ');
  };
  grp.onchange = draw; draw();
  const sorted = [...funds].sort((a, b) => metrics[a.ticker].drawdown_from_peak - metrics[b.ticker].drawdown_from_peak);
  barChart(el.querySelector('#c2'), sorted.map(e => e.ticker), sorted.map(e => +(metrics[e.ticker].drawdown_from_peak * 100).toFixed(1)),
    { title: '% below 3-year peak', fmt: v => v + '%' });
}
