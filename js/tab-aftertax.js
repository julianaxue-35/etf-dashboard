import { groupedBar } from './charts.js';
import { afterTaxOutcome, superOutcome } from './tax.js';
import { esc, trustBadge } from './ui.js';

const money = v => '$' + Math.round(v).toLocaleString('en-AU');
const RATES = [0.08, 0.09, 0.10];

export function render(el, ctx) {
  const rules = ctx.tax, funds = ctx.etfs.filter(e => e.category !== 'reference');
  const s = ctx.store, v0 = s.get('tax:in', { t: 'A200', amt: 20000, yrs: 10, inc: 100000, ret: 30000, y: null, f: null });
  el.innerHTML = `
  <div class="takeaway" id="tk"></div>
  <div class="card"><div class="row">
    <div><label for="tf">Fund</label><select id="tf">${funds.map(e => `<option value="${esc(e.ticker)}">${esc(e.ticker)}</option>`).join('')}</select></div>
    <div><label for="ta">Amount ($)</label><input id="ta" type="number" min="0" step="1000" value="${v0.amt}"></div>
    <div><label for="ty">Years held</label><input id="ty" type="number" min="1" max="60" value="${v0.yrs}"></div></div>
    <div class="row">
    <div><label for="ti">Your other taxable income now ($/yr)</label><input id="ti" type="number" min="0" step="5000" value="${v0.inc}"></div>
    <div><label for="tr">Income in the year you sell ($)</label><input id="tr" type="number" min="0" step="5000" value="${v0.ret}"></div>
    <div><label for="tdy">Yearly distribution (%) <span class="sub">last 12 months</span></label><input id="tdy" type="number" min="0" step="0.1"></div>
    <div><label for="tfr">Franked (%) <span class="sub">see Dividends tab</span></label><input id="tfr" type="number" min="0" max="100" step="5"></div></div>
    <div class="sub" id="msg" role="alert"></div></div>
  <div class="card"><h2>What you keep after tax</h2><div class="chart"><canvas id="c" role="img" aria-label="Value before and after tax"></canvas></div>
    <div class="sub">Source: ATO tax rates ${esc(rules.year)} ${trustBadge(ctx.trust._ato)}</div></div>
  <div class="card"><h2>In numbers</h2><div class="tablewrap"><table id="tb"></table></div>
    <ul class="tight sub"><li>Selling in a low-income year (e.g. early retirement) can cut capital gains tax.</li>
    <li>A bank's 6% interest is fully taxed every year, so it is worth less than 6% after tax.</li></ul>
    <details class="more"><summary>More</summary>
      <ul class="tight"><li><b>Today's rule:</b> half the gain is taxed if held 12+ months.</li>
      <li><b>Proposed rule:</b> ${esc(rules.cgt_reform.summary)}. Status: ${esc(rules.cgt_reform.status)}. Shown assuming ${(rules.cpi_default * 100).toFixed(1)}% inflation.</li>
      <li><b>Super:</b> shown for money from your savings: no tax going in, 15% tax on earnings while saving, tax-free once drawn after 60. Money is locked until then. Salary-sacrificing pre-tax pay is taxed 15% going in, which can beat your normal rate; contribution limits apply, so ask an accountant.</li>
      <li>Distributions are taxed each year at your rate, with franking credits applied. Medicare levy included. Simplified: no offsets, deductions or Medicare surcharge.</li>
      <li>Rates checked ${esc(rules.checked)} against ato.gov.au. Confirm with an accountant before selling.</li></ul></details></div>`;
  const q = id => el.querySelector('#' + id);
  q('tf').value = funds.some(e => e.ticker === v0.t) ? v0.t : funds[0].ticker;
  // Defaults come from the fund's real last-12-month distributions (Dividends tab); franking is the issuer figure or an estimate.
  const setDefaults = () => { const d = ctx.dividends[q('tf').value]; q('tdy').value = d && d.ttm_yield !== null ? +(d.ttm_yield * 100).toFixed(1) : 0; q('tfr').value = d && d.franking.value ? +(d.franking.value * 100).toFixed(0) : 0; };
  if (v0.y === null) setDefaults(); else { q('tdy').value = v0.y; q('tfr').value = v0.f; }
  const draw = () => {
    const inp = { t: q('tf').value, amt: +q('ta').value, yrs: +q('ty').value, inc: +q('ti').value, ret: +q('tr').value, y: +q('tdy').value, f: +q('tfr').value };
    s.set('tax:in', inp); q('msg').textContent = '';
    try {
      const base = r => ({ principal: inp.amt, annualReturn: r, years: inp.yrs, yieldPct: inp.y / 100, frankingPct: inp.f / 100, otherIncome: inp.inc, saleIncome: inp.ret });
      const rows = RATES.map(r => ({ r, cur: afterTaxOutcome(base(r), rules), idx: afterTaxOutcome({ ...base(r), cgtRule: 'indexed' }, rules), sup: superOutcome({ principal: inp.amt, annualReturn: r, years: inp.yrs }, rules) }));
      const nr = afterTaxOutcome({ principal: inp.amt, annualReturn: 0.06, years: inp.yrs, yieldPct: 0.06, frankingPct: 0, otherIncome: inp.inc, saleIncome: inp.inc }, rules);
      const labels = RATES.map(r => `${r * 100}% a year`);
      groupedBar(q('c'), labels, [
        { label: 'No-risk 6% (after tax)', data: rows.map(() => Math.round(nr.net)), color: '#b3261e' },
        { label: 'Before tax', data: rows.map(x => Math.round(x.cur.gross)), color: '#5b6675' },
        { label: 'After tax (today\'s rule)', data: rows.map(x => Math.round(x.cur.net)) },
        { label: 'After tax (proposed rule)', data: rows.map(x => Math.round(x.idx.net)), color: '#2f6fb5' },
        { label: 'In super, from savings (after 60)', data: rows.map(x => Math.round(x.sup.net)), color: '#8a4fa8' }], { title: 'Value after ' + inp.yrs + ' years ($)', fmt: v => '$' + Math.round(v / 1000) + 'k' });
      const m = rows[1];
      q('tk').textContent = `${money(inp.amt)} at 9% for ${inp.yrs} years: ${money(m.cur.gross)} before tax, about ${money(m.cur.net)} in your pocket after tax. The no-risk 6% leaves ${money(nr.net)} after tax.`;
      q('tb').innerHTML = '<tr><th>Return</th><th>Before tax</th><th>Tax while holding</th><th>Tax on sale</th><th>You keep</th><th>If rule changes</th><th>In super</th></tr>'
        + rows.map(x => `<tr><td>${x.r * 100}%</td><td>${money(x.cur.gross)}</td><td>${money(x.cur.tax_on_distributions)}</td><td>${money(x.cur.cgt)}</td><td><b>${money(x.cur.net)}</b></td><td>${money(x.idx.net)}</td><td>${money(x.sup.net)}</td></tr>`).join('')
        + `<tr><td>No-risk 6%</td><td>${money(nr.gross)}</td><td>${money(nr.tax_on_distributions)}</td><td>–</td><td><b>${money(nr.net)}</b></td><td>–</td><td>–</td></tr>`;
    } catch (e) { q('msg').textContent = e.message; q('tk').textContent = 'Fix the highlighted input to see results.'; }
  };
  q('tf').onchange = () => { setDefaults(); draw(); };
  ['ta', 'ty', 'ti', 'tr', 'tdy', 'tfr'].forEach(id => q(id).oninput = draw); draw();
}
