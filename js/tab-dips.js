import { lineChart } from './charts.js';
import { dipStatus, tranches, peakPrice, levelPrices } from './dips.js';
import { priceBadge, fmtPct, esc } from './ui.js';

const money = v => '$' + Math.round(v).toLocaleString('en-AU');

export function render(el, ctx) {
  const funds = ctx.etfs.filter(e => ctx.metrics[e.ticker] && e.category !== 'reference');
  const lv0 = ctx.store.get('dip:levels', [15, 25, 35]), res0 = ctx.store.get('dip:reserve', 10000), t0 = ctx.store.get('dip:ticker', 'NDQ');
  el.innerHTML = `
  <div class="takeaway" id="tk"></div>
  <div class="card"><div class="row">
    <div><label for="df">Fund to watch</label><select id="df">${funds.map(e => `<option value="${esc(e.ticker)}">${esc(e.ticker)} – ${esc(e.name)}</option>`).join('')}</select></div>
    <div><label for="dr">Cash set aside to buy dips ($)</label><input id="dr" type="number" min="0" step="1000" value="${res0}"></div></div>
    <div class="row"><div><label>Buy levels: % below peak</label>
      <div class="row"><input class="lv" type="number" min="1" max="90" value="${lv0[0]}" aria-label="Level 1"><input class="lv" type="number" min="1" max="90" value="${lv0[1]}" aria-label="Level 2"><input class="lv" type="number" min="1" max="90" value="${lv0[2]}" aria-label="Level 3"></div></div></div>
    <div class="sub" id="msg" role="alert"></div></div>
  <div class="card"><h2>Price and your buy levels</h2><div class="chart"><canvas id="c" role="img" aria-label="Price with dip buy levels"></canvas></div>
    <div class="sub">Source: <span id="tb"></span> <span id="asat"></span></div></div>
  <div class="card"><h2>Your plan</h2><div class="tablewrap"><table id="pt"></table></div>
    <div class="sub" id="note"></div>
    <details class="more"><summary>More</summary>Nobody can time a bubble. A fall can keep going after your first buy, which is why cash is split across levels (30% / 30% / 40%) instead of all at once. Peak = highest price in the last 3 years. Alerts show here only.</details></div>`;
  const sel = el.querySelector('#df'); sel.value = funds.some(e => e.ticker === t0) ? t0 : funds[0].ticker;
  const draw = () => {
    const t = sel.value, m = ctx.metrics[t], e = ctx.etfs.find(x => x.ticker === t);
    const raw = [...el.querySelectorAll('.lv')].map(i => +i.value);
    const msg = el.querySelector('#msg'); msg.textContent = '';
    if (raw.some(v => !(v >= 1 && v <= 90))) { msg.textContent = 'Levels must be between 1% and 90%.'; return; }
    const levels = raw.map(v => -v / 100).sort((a, b) => b - a);
    const reserve = Math.max(0, +el.querySelector('#dr').value || 0);
    el.querySelector('#tb').innerHTML = priceBadge(ctx.trust, t); el.querySelector('#asat').textContent = 'Price as at ' + m.last_date + '.';
    ctx.store.set('dip:ticker', t); ctx.store.set('dip:levels', raw); ctx.store.set('dip:reserve', reserve);
    const peak = peakPrice(m.last_close, m.drawdown_from_peak), st = dipStatus(m.drawdown_from_peak, levels);
    const tr = tranches(reserve, levels), prices = levelPrices(peak, levels);
    const p = ctx.prices[t];
    lineChart(el.querySelector('#c'), [{ label: t + ' price', dates: p.d, values: p.p },
      ...levels.map((l, i) => ({ label: `-${Math.round(-l * 100)}% level`, dates: p.d, values: p.d.map(() => +prices[i].toFixed(2)), dash: true, color: ['#c27c0e', '#b3261e', '#7a1fa2'][i] }))], 'Price ($)');
    el.querySelector('#tk').textContent = st.hit.length
      ? `${t} is ${fmtPct(-m.drawdown_from_peak, 0)} below its peak: ${st.hit.length} of ${levels.length} buy levels reached.`
      : `${t} is ${fmtPct(-m.drawdown_from_peak, 0)} below its peak: no buy level reached yet${st.next !== null ? ` (first at -${Math.round(-st.next * 100)}%)` : ''}.`;
    el.querySelector('#pt').innerHTML = '<tr><th>Level</th><th>Price</th><th>Buy</th><th>Status</th></tr>'
      + levels.map((l, i) => `<tr><td>-${Math.round(-l * 100)}%</td><td>$${prices[i].toFixed(2)}</td><td>${money(tr[i])}</td><td class="${st.hit.includes(l) ? 'good' : ''}">${st.hit.includes(l) ? '✔ Reached' : 'Waiting'}</td></tr>`).join('');
    el.querySelector('#note').textContent = `Worst fall in the last 3 years: ${fmtPct(m.max_drawdown_3y, 0)}. ${e.notes || ''}`;
  };
  sel.onchange = draw; el.querySelector('#dr').oninput = draw; el.querySelectorAll('.lv').forEach(i => i.oninput = draw); draw();
}
