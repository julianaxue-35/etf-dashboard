import { barChart } from './charts.js';
import { dividendIncome } from './tax.js';
import { trustBadge, fmtPct, esc } from './ui.js';

const money = v => '$' + Math.round(v).toLocaleString('en-AU');
const money2 = v => '$' + v.toFixed(2);

export function render(el, ctx) {
  const funds = ctx.etfs.filter(e => ctx.dividends[e.ticker]);
  const inc0 = (ctx.store.get('tax:in', {}) || {}).inc ?? 100000;
  const v0 = ctx.store.get('div:in', { t: 'A200', amt: 20000 });
  el.innerHTML = `
  <div class="takeaway" id="tk"></div>
  <div class="card"><div class="row">
    <div><label for="df">Fund</label><select id="df">${funds.map(e => `<option value="${esc(e.ticker)}">${esc(e.ticker)} – ${esc(e.name)}</option>`).join('')}</select></div>
    <div><label for="da">Amount invested ($)</label><input id="da" type="number" min="0" step="1000" value="${v0.amt}"></div>
    <div><label for="di">Your other taxable income ($/yr)</label><input id="di" type="number" min="0" step="5000" value="${inc0}"></div></div>
    <div class="sub" id="msg" role="alert"></div></div>
  <div class="card"><h2>Cash paid out in the last 12 months (% of price)</h2>
    <div class="chart" id="w1"><canvas id="c1" role="img" aria-label="Distribution yield by fund"></canvas></div>
    <div class="sub">Tall bar = more cash paid out, not necessarily a better fund.</div></div>
  <div class="card"><h2 id="h2"></h2>
    <div class="grid"><div><div class="chart" style="height:220px"><canvas id="c2" role="img" aria-label="Distributions per unit by year"></canvas></div>
      <div class="sub">Cash per unit each calendar year (this year may be incomplete).</div></div>
    <div><div class="tablewrap"><table id="inc"></table></div>
      <div class="sub" id="bd"></div></div></div></div>
  <div class="card"><h2>Recent payments</h2><div class="tablewrap"><table id="pay"></table></div>
    <details class="more"><summary>More</summary><ul class="tight">
      <li>Dividends are not extra money. A fund's price drops by roughly the payout on the day it goes ex-dividend. Total return (shown elsewhere) already includes them.</li>
      <li>Yield here = cash paid in the last 12 months ÷ today's price. It is a past figure, not a forecast, and can swing year to year.</li>
      <li>Very high yields (e.g. some tech or infrastructure funds) can include realised capital gains handed back to you, and are taxed.</li>
      <li><b>Franking credits</b> are tax already paid by Australian companies. They offset your tax, and if your tax is lower than the credit the ATO refunds the difference. Overseas shares carry none.</li>
      <li>Franking shares: A200 is the issuer's published 12-month figure; others are estimates. Your annual tax statement from the fund has the exact amounts.</li></ul></details></div>`;
  const q = id => el.querySelector('#' + id);
  const ranked = [...funds].filter(e => ctx.dividends[e.ticker].ttm_yield !== null).sort((a, b) => ctx.dividends[b.ticker].ttm_yield - ctx.dividends[a.ticker].ttm_yield);
  q('w1').style.height = Math.max(260, ranked.length * 24) + 'px';
  barChart(q('c1'), ranked.map(e => e.ticker), ranked.map(e => +(ctx.dividends[e.ticker].ttm_yield * 100).toFixed(2)), { title: '% of price paid out', fmt: v => v + '%' });
  q('df').value = funds.some(e => e.ticker === v0.t) ? v0.t : funds[0].ticker;
  const draw = () => {
    const t = q('df').value, d = ctx.dividends[t], e = ctx.etfs.find(x => x.ticker === t), m = ctx.metrics[t];
    const amt = +q('da').value, inc = +q('di').value;
    ctx.store.set('div:in', { t, amt });
    q('msg').textContent = '';
    q('h2').textContent = `${t}: what you could receive`;
    const fr = d.franking.value ?? 0;
    let r;
    try { r = dividendIncome({ amount: amt, yieldPct: d.ttm_yield || 0, frankingPct: fr, otherIncome: inc }, ctx.tax); }
    catch (err) { q('msg').textContent = err.message; q('tk').textContent = 'Fix the highlighted input to see results.'; return; }
    const units = m && m.last_close ? amt / m.last_close : 0;
    q('tk').textContent = d.ttm_amount > 0
      ? `${t} paid ${fmtPct(d.ttm_yield)} in the last 12 months (${d.frequency.toLowerCase()}): about ${money(r.cash)} a year on ${money(amt)}, ${money(r.netCash)} in your pocket after tax.`
      : `${t} paid no distributions in the last 12 months.`;
    barChart(q('c2'), d.by_year.map(y => String(y.year)), d.by_year.map(y => y.amount), { horizontal: false, title: '$ per unit', fmt: v => '$' + (+v).toFixed(2) });
    const frTxt = d.franking.value === null ? 'unknown: check statement' : fmtPct(d.franking.value, 0);
    q('inc').innerHTML = `<tr><td>Cash paid to you</td><td><b>${money(r.cash)}</b></td></tr>
      <tr><td>Franking credit (${frTxt} franked)</td><td>${money(r.credit)}</td></tr>
      <tr><td>${r.taxPayable < 0 ? 'Tax refund from credits' : 'Extra tax to pay'}</td><td>${money(Math.abs(r.taxPayable))}</td></tr>
      <tr><td>In your pocket after tax</td><td><b>${money(r.netCash)}</b></td></tr>
      <tr><td>Paid</td><td>${esc(d.frequency)}${d.last_date ? ', last ' + esc(d.last_date) : ''}</td></tr>`;
    q('bd').innerHTML = `Payments: ${trustBadge(d.trust)} · Franking: ${trustBadge(d.franking)}`;
    q('pay').innerHTML = '<tr><th>Date</th><th>$ per unit</th><th>You would get</th></tr>' + [...d.recent].reverse().map(p => `<tr><td>${esc(p.date)}</td><td>${money2(p.amount)}</td><td>${money2(p.amount * units)}</td></tr>`).join('');
  };
  q('df').onchange = draw; q('da').oninput = draw; q('di').oninput = draw; draw();
}
