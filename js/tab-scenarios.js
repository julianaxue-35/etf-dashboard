import { lineChart } from './charts.js';
import { priceBadge, fmtPct, esc } from './ui.js';

const H = ['0.5', '1', '3', '5', '10'];
const money = v => '$' + Math.round(v).toLocaleString('en-AU');
const label = h => (h === '0.5' ? '6 mo' : h === '1' ? '1 yr' : h + ' yrs');

export function render(el, ctx) {
  const funds = ctx.etfs.filter(e => ctx.scenarios[e.ticker] && e.category !== 'reference');
  const amt0 = ctx.store.get('scen:amount', 20000), t0 = ctx.store.get('scen:ticker', 'A200');
  el.innerHTML = `
  <div class="takeaway" id="tk"></div>
  <div class="card"><div class="row">
    <div><label for="sf">Fund</label><select id="sf">${funds.map(e => `<option value="${esc(e.ticker)}">${esc(e.ticker)} – ${esc(e.name)}</option>`).join('')}</select></div>
    <div><label for="sa">Amount invested ($)</label><input id="sa" type="number" min="0" step="1000" value="${amt0}"></div></div></div>
  <div class="card"><h2>Where $<span id="amtl"></span> could end up</h2>
    <div class="chart"><canvas id="c" role="img" aria-label="Range of possible outcomes over time"></canvas></div>
    <div class="sub">Price history source: <span id="tb"></span></div>
    <div class="sub" id="lim"></div>
    <details class="more"><summary>More</summary>Bad / good case = 10th / 90th percentile of 5,000 simulated paths built by reshuffling this fund's own past daily returns. Real outcomes can fall outside this range. A short or unusually strong history makes it too optimistic.</details></div>
  <div class="card"><h2>Chance of beating your goals</h2><div class="tablewrap"><table id="pt"></table></div></div>`;
  el.querySelector('#sf').value = funds.some(e => e.ticker === t0) ? t0 : funds[0].ticker;
  const draw = () => {
    const t = el.querySelector('#sf').value, amt = Math.max(0, +el.querySelector('#sa').value || 0);
    el.querySelector('#tb').innerHTML = priceBadge(ctx.trust, t);
    ctx.store.set('scen:ticker', t); ctx.store.set('scen:amount', amt);
    el.querySelector('#amtl').textContent = amt.toLocaleString('en-AU');
    const sc = ctx.scenarios[t]; const hs = H.filter(h => sc[h]);
    const lbl = hs.map(label), xs = hs.map(Number);
    const vals = k => hs.map(h => Math.round(sc[h][k] * amt));
    lineChart(el.querySelector('#c'), [
      { label: 'Good case (1 in 10)', dates: lbl, xs, xunit: ' yr', values: vals('p90') },
      { label: 'Middle case', dates: lbl, xs, xunit: ' yr', values: vals('p50') },
      { label: 'Bad case (1 in 10)', dates: lbl, xs, xunit: ' yr', values: vals('p10') },
      { label: '6% no-risk rate', dates: lbl, xs, xunit: ' yr', values: hs.map(h => Math.round(amt * Math.pow(1.06, +h))), dash: true, color: '#b3261e' }], 'Value ($)');
    const last = hs[hs.length - 1];
    el.querySelector('#tk').textContent = hs.length
      ? `${t}: after ${label(last)}, ${money(amt)} could be about ${money(sc[last].p50 * amt)} in the middle case, and ${money(sc[last].p10 * amt)} in a bad case. The 6% no-risk rate gives ${money(amt * Math.pow(1.06, +last))}.` : 'Not enough history to project.';
    el.querySelector('#lim').textContent = sc.limited_history ? 'Short history (under 3 years): only up to 1 year shown. Treat with caution.' : '';
    el.querySelector('#pt').innerHTML = '<tr><th>Time</th><th>Beats 6%</th><th>Reaches 8%/yr</th><th>Reaches 10%/yr</th></tr>'
      + hs.map(h => `<tr><td>${label(h)}</td><td>${fmtPct(sc[h].prob_beat_6, 0)}</td><td>${fmtPct(sc[h].prob_reach_8, 0)}</td><td>${fmtPct(sc[h].prob_reach_10, 0)}</td></tr>`).join('');
  };
  el.querySelector('#sf').onchange = draw; el.querySelector('#sa').oninput = draw; draw();
}
