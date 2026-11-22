import { lineChart, groupedBar } from './charts.js';
import { monthlyNeeded, balanceAt, rollingDca, buildSchedule } from './contrib.js';
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
    <details class="more"><summary>More</summary>Tested on every 12-month window in the last 3 years of weekly prices. Spread = one-twelfth bought each month; cash waiting earns nothing here (a savings account would help it slightly). History here is mostly a rising market, which favours lump sums; spreading mainly reduces regret if prices fall soon after you buy.</details></div>
  <div class="card"><h2>Your 12-month buying plan</h2>
    <div class="row"><div><label for="sm">Months to spread over</label><input id="sm" type="number" min="1" max="60" value="12"></div>
    <div><label for="sd">First buy on</label><input id="sd" type="date"></div>
    <div><label for="sb">Brokerage per buy ($) <span class="sub">assumed: check your broker</span></label><input id="sb" type="number" min="0" step="1" value="5"></div></div>
    <div class="sub" id="smsg" role="alert"></div>
    <div class="chart" style="height:220px"><canvas id="c3" role="img" aria-label="Money invested over time"></canvas></div>
    <div class="tablewrap"><table id="st"></table></div>
    <ul class="tight" id="sn"></ul>
    <details class="more"><summary>More</summary><ul class="tight">
      <li>Buying a little each month means you buy at highs and lows, so your average price smooths out. It does not guarantee a lower price than buying in one go.</li>
      <li>Money waiting to be invested should sit in savings, where it earns interest.</li>
      <li>You could also keep some cash for the dip levels on the Dips tab and buy extra if prices fall a long way.</li>
      <li>Brokerage is an assumption; many brokers charge per trade, so fewer, larger buys cost less.</li></ul></details></div>`;
  const q = id => el.querySelector('#' + id);
  { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + 1); q('sd').value = d.toISOString().slice(0, 10); }
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
    try {
      const sch = buildSchedule({ amount: inp.lump, months: +q('sm').value, start: q('sd').value, brokerage: +q('sb').value });
      q('smsg').textContent = '';
      lineChart(q('c3'), [{ label: 'Total invested ($)', dates: sch.rows.map(r => r.date), values: sch.rows.map(r => r.cumulative) }], 'Invested ($)');
      q('st').innerHTML = '<tr><th>#</th><th>Date</th><th>Buy</th><th>Brokerage</th><th>Total invested</th></tr>' + sch.rows.map(r => `<tr><td>${r.n}</td><td>${r.date}</td><td>${'$' + r.buy.toFixed(2)}</td><td>${'$' + r.brokerage.toFixed(2)}</td><td>${money(r.cumulative)}</td></tr>`).join('');
      q('sn').innerHTML = `<li>${sch.rows.length} buys of about ${money(sch.rows[0].buy)} each.</li><li>Brokerage totals ${money(sch.totalBrokerage)} (${fmtPct(sch.brokeragePct, 1)} of the amount), against ${money(+q('sb').value)} for a single lump-sum buy.</li>`;
    } catch (e) { q('smsg').textContent = e.message; q('st').innerHTML = ''; q('sn').innerHTML = ''; }
    const p = ctx.prices[inp.t].p, r = rollingDca(p, 12);
    if (!r || !(inp.lump >= 0)) { q('dl').innerHTML = '<li>Not enough price history for this test.</li>'; return; }
    groupedBar(q('c2'), ['Typical 12-month result'], [{ label: 'All at once', data: [Math.round(inp.lump * r.medianLump)] }, { label: 'Spread over 12 months', data: [Math.round(inp.lump * r.medianDca)] }].map((d, i) => ({ ...d, color: i ? '#c27c0e' : '#0f5f4a' })), { title: `Value of ${money(inp.lump)} after 12 months ($)`, fmt: v => '$' + Math.round(v).toLocaleString('en-AU') });
    q('dl').innerHTML = `<li>Spreading beat a lump sum in <b>${fmtPct(r.dcaWinRate, 0)}</b> of ${r.windows} past 12-month windows.</li>
      <li>Typically a lump sum was ${fmtPct(Math.abs(r.medianDiff), 1)} ${r.medianDiff >= 0 ? 'better' : 'worse'}; in the worst window it was ${fmtPct(Math.abs(r.worstLumpDiff), 0)} ${r.worstLumpDiff >= 0 ? 'better' : 'worse'}.</li>`;
  };
  ['pg', 'ps', 'py', 'pl', 'sm', 'sd', 'sb'].forEach(id => q(id).oninput = draw); q('pf').onchange = draw; draw();
}
