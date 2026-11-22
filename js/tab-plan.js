import { lineChart, groupedBar } from './charts.js';
import { monthlyNeeded, balanceAt, rollingDca } from './contrib.js';
import { priceBadge, fmtPct, esc } from './ui.js';

const money = v => '$' + Math.round(v).toLocaleString('en-AU');
const RATES = [0.06, 0.08, 0.10];

export function render(el, ctx) {
  const s = ctx.store, v0 = s.get('plan:in', { goal: 50000, start: 20000, yrs: 10, t: 'A200', lump: 12000 });
  const funds = ctx.etfs.filter(e => ctx.prices[e.ticker] && e.category !== 'reference');
  el.innerHTML = `
  <div class="takeaway" id="tk"></div>
  <div class="card"><h2>How much to add each month</h2>
    <div class="row"><div><label for="pg">Goal ($)</label><input id="pg" type="number" min="0" step="5000" value="${v0.goal}"></div>
    <div><label for="ps">Already invested ($)</label><input id="ps" type="number" min="0" step="1000" value="${v0.start}"></div>
    <div><label for="py">Years until you need it</label><input id="py" type="number" min="1" max="60" value="${v0.yrs}"></div></div>
    <div class="sub" id="msg" role="alert"></div>
    <div class="chart"><canvas id="c1" role="img" aria-label="Balance growth at 6, 8 and 10 percent"></canvas></div>
    <div class="tablewrap"><table id="t1"></table></div>
    <div class="sub">Returns are not guaranteed: shares can fall for years. See the Risk tab.</div>
    <details class="more"><summary>More</summary>Each line shows the balance if you add the monthly amount in the table at that yearly return. Returns are assumptions, not forecasts. Before tax. Contributions made at the end of each month.</details></div>
  <div class="card"><h2>One lump sum or spread over 12 months?</h2>
    <div class="row"><div><label for="pf">Fund</label><select id="pf">${funds.map(e => `<option value="${esc(e.ticker)}">${esc(e.ticker)}</option>`).join('')}</select></div>
    <div><label for="pl">Amount ($)</label><input id="pl" type="number" min="0" step="1000" value="${v0.lump}"></div></div>
    <div class="chart" style="height:220px"><canvas id="c2" role="img" aria-label="Lump sum versus spread over 12 months"></canvas></div>
    <ul class="tight" id="dl"></ul>
    <div class="sub">Source: <span id="tb"></span></div>
    <details class="more"><summary>More</summary>Tested on every 12-month window in the last 3 years of weekly prices. Spread = one-twelfth bought each month; cash waiting earns nothing here (a savings account would help it slightly). History here is mostly a rising market, which favours lump sums; spreading mainly reduces regret if prices fall soon after you buy.</details></div>`;
  const q = id => el.querySelector('#' + id);
  q('pf').value = funds.some(e => e.ticker === v0.t) ? v0.t : funds[0].ticker;
  const draw = () => {
    const inp = { goal: +q('pg').value, start: +q('ps').value, yrs: +q('py').value, t: q('pf').value, lump: +q('pl').value };
    s.set('plan:in', inp); q('msg').textContent = '';
    const res = RATES.map(r => ({ r, ...monthlyNeeded({ goal: inp.goal, startBalance: inp.start, years: inp.yrs, annualReturn: r }) }));
    const bad = res.find(x => x.value === null);
    if (bad) { q('msg').textContent = bad.reason; q('tk').textContent = 'Fix the highlighted input to see results.'; }
    else {
      const m = res[1];
      q('tk').textContent = `To reach ${money(inp.goal)} in ${inp.yrs} years from ${money(inp.start)}: about ${money(res[1].value)}/month at 8%, ${money(res[0].value)} at 6%, ${money(res[2].value)} at 10%.`;
      const months = Array.from({ length: inp.yrs + 1 }, (_, y) => y);
      lineChart(q('c1'), res.map(x => ({ label: `${x.r * 100}% a year (${money(x.value)}/mo)`, dates: months.map(y => 'Yr ' + y), xs: months, xunit: ' yr',
        values: months.map(y => Math.round(balanceAt({ startBalance: inp.start, monthly: x.value, annualReturn: x.r, months: y * 12 }))) })), 'Balance ($)');
      q('t1').innerHTML = '<tr><th>Yearly return</th><th>Add each month</th><th>You put in</th><th>Growth</th></tr>' + res.map(x => {
        const put = inp.start + x.value * inp.yrs * 12; return `<tr><td>${x.r * 100}%</td><td><b>${money(x.value)}</b></td><td>${money(put)}</td><td>${inp.goal >= put ? money(inp.goal - put) : '–'}</td></tr>`; }).join('');
    }
    q('tb').innerHTML = priceBadge(ctx.trust, inp.t);
    const p = ctx.prices[inp.t].p, r = rollingDca(p, 12);
    if (!r || !(inp.lump >= 0)) { q('dl').innerHTML = '<li>Not enough price history for this test.</li>'; return; }
    groupedBar(q('c2'), ['Typical 12-month result'], [{ label: 'All at once', data: [Math.round(inp.lump * r.medianLump)] }, { label: 'Spread over 12 months', data: [Math.round(inp.lump * r.medianDca)] }].map((d, i) => ({ ...d, color: i ? '#c27c0e' : '#0f5f4a' })), { title: `Value of ${money(inp.lump)} after 12 months ($)`, fmt: v => '$' + Math.round(v).toLocaleString('en-AU') });
    q('dl').innerHTML = `<li>Spreading beat a lump sum in <b>${fmtPct(r.dcaWinRate, 0)}</b> of ${r.windows} past 12-month windows.</li>
      <li>Typically a lump sum was ${fmtPct(Math.abs(r.medianDiff), 1)} ${r.medianDiff >= 0 ? 'better' : 'worse'}; in the worst window it was ${fmtPct(Math.abs(r.worstLumpDiff), 0)} ${r.worstLumpDiff >= 0 ? 'better' : 'worse'}.</li>`;
  };
  ['pg', 'ps', 'py', 'pl'].forEach(id => q(id).oninput = draw); q('pf').onchange = draw; draw();
}
