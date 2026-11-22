import { barChart, groupedBar } from './charts.js';
import { gainNeeded, recoveryYears, afterFall, lossLabel, fmtDays } from './risk.js';
import { fmtPct, trustBadge, esc } from './ui.js';

const money = v => '$' + Math.round(v).toLocaleString('en-AU');
const H = ['0.5', '1', '3', '5', '10'];
const hl = h => (h === '0.5' ? '6 mo' : h === '1' ? '1 yr' : h + ' yrs');

export function render(el, ctx) {
  const funds = ctx.etfs.filter(e => ctx.metrics[e.ticker] && ctx.metrics[e.ticker].worst_12m !== null && ctx.metrics[e.ticker].worst_12m !== undefined);
  const v0 = ctx.store.get('risk:in', { t: 'A200', amt: ctx.store.get('scen:amount', 20000), fall: 30 });
  const ranked = [...funds].sort((a, b) => ctx.metrics[b.ticker].pct_12m_negative - ctx.metrics[a.ticker].pct_12m_negative);
  const worst = [...funds].sort((a, b) => ctx.metrics[a.ticker].worst_12m - ctx.metrics[b.ticker].worst_12m);
  el.innerHTML = `
  <div class="takeaway" id="tk"></div>
  <div class="card"><h2>Shares go down as well as up. A covered bank deposit does not.</h2>
    <div class="sub">How often each fund lost money over a 12-month stretch in its past data (covered bank deposit: never). Grey bars have under 5 years of data, so the true loss rate is probably higher.</div>
    <div class="chart" id="w1"><canvas id="c1" role="img" aria-label="Share of 12-month periods with a loss by fund"></canvas></div>
    <div class="sub">Based on up to the last 10 years, mostly a rising market. Data: Yahoo Finance (unofficial), cross-checked with the ASX; each fund's score is on the Compare tab.</div></div>
  <div class="card"><h2>Worst 12 months in its past data</h2>
    <div class="chart" id="w2"><canvas id="c2" role="img" aria-label="Worst 12-month return by fund"></canvas></div>
    <div class="sub">Single stocks (CSL) can fall far more than funds.</div></div>
  <div class="card"><div class="row"><div><label for="rf">Fund</label><select id="rf">${funds.map(e => `<option value="${esc(e.ticker)}">${esc(e.ticker)} – ${esc(e.name)}</option>`).join('')}</select></div>
    <div><label for="ra">Amount invested ($)</label><input id="ra" type="number" min="0" step="1000" value="${v0.amt}"></div>
    <div><label for="rfall">Test a fall of (%)</label><input id="rfall" type="number" min="1" max="99" value="${v0.fall}"></div></div>
    <div class="sub" id="msg" role="alert"></div></div>
  <div class="card"><h2 id="h3"></h2><div class="chart" style="height:240px"><canvas id="c3" role="img" aria-label="Chance of loss by time held"></canvas></div>
    <div class="tablewrap"><table id="t3"></table></div>
    <div class="banner">These odds reshuffle short blocks of past prices, so long bear markets are under-represented: the Nasdaq fell 74% to 83% in 2000 to 2002 and the ASX 200 about 54% in 2007 to 2009. Real risk of loss is higher.</div>
    <div class="sub" id="hid"></div></div>
  <div class="card"><h2 id="h4"></h2><div class="tablewrap"><table id="t4"></table></div>
    <div class="sub" id="uw"></div>
    <div class="sub" id="dv"></div></div>
  <div class="card"><h2>Big crashes in the past</h2><div class="tablewrap"><table id="t5" class="tw"></table></div>
    <div class="sub">Source: ${trustBadge(ctx.trust._history)}</div></div>
  <div class="card"><h2>What is protected, and what is not</h2><ul class="tight">
    <li><b>6% savings:</b> a deposit with a licensed bank, building society or credit union is protected up to $250,000 per person per institution (Government guarantee). 6% is a high rate, so check it is a covered deposit and not a non-bank or credit fund. The rate can change when you renew, and inflation can eat the return.</li>
    <li><b>ETFs and shares:</b> no guarantee. You can get back less than you put in, and it can take years to recover.</li>
    <li><b>Dividends:</b> not guaranteed. Companies and funds can cut or stop them, and you may not receive franking credits you expected.</li>
    <li><b>Selling at the wrong time</b> locks in a loss. The longer you can leave it, the lower the chance of ending with less than you put in.</li></ul>
    <div class="sub">Guarantee: Financial Claims Scheme (APRA, MoneySmart). Not personal financial advice.</div></div>`;
  const q = id => el.querySelector('#' + id);
  q('w1').style.height = Math.max(240, ranked.length * 24) + 'px'; q('w2').style.height = Math.max(240, worst.length * 24) + 'px';
  const short = e => ctx.metrics[e.ticker].history_years < 5;
  const lab = e => `${e.ticker} (${ctx.metrics[e.ticker].history_years.toFixed(1)}y${short(e) ? ', short data' : ''})`;
  const tone = e => (short(e) ? '#9aa6b4' : '#b3261e');
  barChart(q('c1'), ranked.map(lab), ranked.map(e => +(ctx.metrics[e.ticker].pct_12m_negative * 100).toFixed(1)), { title: '% of 12-month periods that lost money', fmt: v => v + '%', color: ranked.map(tone) });
  barChart(q('c2'), worst.map(lab), worst.map(e => +(ctx.metrics[e.ticker].worst_12m * 100).toFixed(1)), { title: 'worst 12-month return (%)', fmt: v => v + '%', color: worst.map(tone) });
  q('rf').value = funds.some(e => e.ticker === v0.t) ? v0.t : funds[0].ticker;
  // static history table
  q('t5').innerHTML = '<tr><th>Crash</th><th>Fell</th><th>Time to recover</th></tr>' + (ctx.stress || []).map(s => `<tr><td>${esc(s.label)}<div class="sub">${esc(s.note)}</div></td><td>${esc(s.fall_text)}</td><td>${esc(s.recovery_text)}</td></tr>`).join('');
  const draw = () => {
    const t = q('rf').value, m = ctx.metrics[t], sc = ctx.scenarios[t] || {}, d = ctx.dividends[t];
    const amt = +q('ra').value, fall = +q('rfall').value / 100;
    q('msg').textContent = '';
    ctx.store.set('risk:in', { t, amt, fall: +q('rfall').value });
    let stress;
    try { stress = { val: afterFall(amt, fall), gain: gainNeeded(fall) }; } catch (e) { q('msg').textContent = e.message; q('tk').textContent = 'Fix the highlighted input to see results.'; return; }
    q('tk').textContent = `${t} lost money in ${fmtPct(m.pct_12m_negative, 0)} of past 12-month periods; its worst 12 months were ${fmtPct(m.worst_12m, 0)}. A ${Math.round(fall * 100)}% fall turns ${money(amt)} into ${money(stress.val)}. A 6% deposit in a covered bank account does not fall.`;
    q('h3').textContent = `${t}: chance of ending with less`;
    const hs = H.filter(h => sc[h] && !sc[h].beyond_history);
    q('hid').textContent = H.some(h => sc[h] && sc[h].beyond_history) ? `Longer horizons are hidden because ${t} has only ${m.history_years.toFixed(1)} years of data.` : '';
    if (hs.length) {
      groupedBar(q('c3'), hs.map(hl), [{ label: 'Less than you put in', data: hs.map(h => +(sc[h].prob_loss * 100).toFixed(1)), color: '#b3261e' }, { label: 'Less than 6% savings would give', data: hs.map(h => +(sc[h].prob_below_6 * 100).toFixed(1)), color: '#c27c0e' }], { title: '% chance', fmt: v => v + '%' });
      q('t3').innerHTML = '<tr><th>Held for</th><th>Less than you put in</th><th>Worse than 6% savings</th><th>Very bad case (1 in 20)</th></tr>' + hs.map(h => `<tr><td>${hl(h)}</td><td>${lossLabel(sc[h].prob_loss)}</td><td>${fmtPct(sc[h].prob_below_6, 0)}</td><td>${money(sc[h].p5 * amt)}</td></tr>`).join('');
    } else { q('t3').innerHTML = '<tr><td>Not enough history to estimate.</td></tr>'; }
    q('h4').textContent = `If ${t} fell ${Math.round(fall * 100)}% soon after you bought`;
    const rows = [0.06, 0.08, 0.10].map(r => { const y = recoveryYears(fall, r); return `<tr><td>${Math.round(r * 100)}% a year</td><td>${y === null ? 'never' : y.toFixed(1) + ' years'}</td></tr>`; }).join('');
    q('t4').innerHTML = `<tr><td>Your ${money(amt)} becomes</td><td><b>${money(stress.val)}</b></td></tr><tr><td>Gain needed to get back to even</td><td><b>${(stress.gain * 100).toFixed(0)}%</b></td></tr><tr><th style="text-align:left">Then, to recover, at</th><th>takes about</th></tr>${rows}`;
    q('uw').textContent = `In its past data ${t} spent as long as ${fmtDays(m.longest_underwater_days)} below an earlier high before getting back.`;
    q('dv').textContent = d && d.worst_yoy_change !== null && d.worst_yoy_change !== undefined
      ? `Over the last ${d.cut_window_years || 10} years its yearly payouts fell by more than 5% in ${d.years_cut} year${d.years_cut === 1 ? '' : 's'}; the worst year-on-year drop was ${fmtPct(d.worst_yoy_change, 0)}. Dividends are not guaranteed.` : '';
  };
  q('rf').onchange = draw; q('ra').oninput = draw; q('rfall').oninput = draw; draw();
}
