import { barChart } from './charts.js';
import { fundSignal, prosCons } from './signal.js';
import { trustBadge, fmtPct, esc } from './ui.js';
import { specificNews } from './news.js';

const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const ICON = { Keep: '✔', Watch: '●', Review: '▲', Unknown: '?' };

export function render(el, ctx) {
  const funds = ctx.etfs.filter(e => ctx.metrics[e.ticker]);
  const levels = (ctx.store.get('dip:levels', [15, 25, 35]) || [15, 25, 35]).map(v => -v / 100);
  const fundTickers = ctx.etfs.filter(e => e.category !== 'reference').map(e => e.ticker);
  const newsAgeH = (ctx.news || {}).updated_utc ? (Date.now() - Date.parse(ctx.news.updated_utc + 'Z')) / 3600000 : Infinity;
  const newsStale = newsAgeH > 48;                       // old stories must not keep counting against a fund
  const allNews = newsStale ? [] : ((ctx.news || {}).items || []);
  const specific = specificNews(allNews, fundTickers);
  const marketNeg = allNews.filter(i => i.tone === 'negative' && !specific.includes(i)).length;
  const sig = {};
  for (const e of funds) sig[e.ticker] = fundSignal({ ticker: e.ticker, metrics: ctx.metrics[e.ticker], news: specific, dipLevels: levels, trustPrice: ctx.trust[e.ticker] && ctx.trust[e.ticker].price }, ctx.rules);
  const count = l => funds.filter(e => sig[e.ticker].level === l).length;
  const cls = l => ({ Keep: 'good', Watch: 'mid', Review: 'bad' }[l] || '');
  const colour = l => ({ Keep: css('--good'), Watch: css('--mid'), Review: css('--bad') }[l] || css('--muted'));
  const sorted = [...funds].sort((a, b) => ctx.metrics[a.ticker].drawdown_from_peak - ctx.metrics[b.ticker].drawdown_from_peak);
  const v0 = ctx.store.get('funds:t', 'A200');
  el.innerHTML = `
  <div class="takeaway">${count('Keep')} of these funds and stocks look fine to keep, ${count('Watch')} to watch, ${count('Review')} to review${count('Unknown') ? `, ${count('Unknown')} without enough data` : ''}. These are rules-based flags for a long-term investor, not advice to buy or sell.${newsStale ? ' News is over 2 days old, so it was ignored.' : ''}${marketNeg ? ` Market-wide there are ${marketNeg} negative stories this week (see News); they are not counted against individual funds.` : ''}</div>
  <div class="card"><h2>How far below the peak, coloured by signal</h2>
    <div class="chart" style="height:${Math.max(260, sorted.length * 24)}px"><canvas id="c1" role="img" aria-label="Fall from peak by fund, coloured by signal"></canvas></div>
    <div class="sub"><span class="good">✔ Keep</span> · <span class="mid">● Watch</span> · <span class="bad">▲ Review</span> (symbol and colour)</div>
    <details class="more"><summary>How the signal works</summary><ul class="tight">
      <li><b>Review</b> only if all three hold: down ${Math.round(-ctx.rules.review_drawdown * 100)}%+ from its peak, below its 200-day average, and losing money over 12 months.</li>
      <li><b>Watch</b> if any one of: down ${Math.round(-ctx.rules.watch_drawdown * 100)}%+ from peak; ${Math.round(-ctx.rules.watch_ma_gap * 100)}%+ below its 200-day average; negative over 12 months; ${ctx.rules.neg_news_watch}+ negative news stories this week about that specific fund or theme (market-wide stories are excluded); price data over ${ctx.rules.stale_days} days old or disagreeing with a second source.</li>
      <li>Otherwise <b>Keep</b>. A fall alone is not a reason to sell; for new money see the Dips tab.</li>
      <li>Thresholds live in config/signal_rules.json. The news tone is a keyword guess. Past patterns do not predict the future.</li></ul></details></div>
  <div class="card"><div class="tablewrap"><table id="tbl" class="tw"></table></div></div>
  <div class="card"><label for="ff">Fund</label><select id="ff">${funds.map(e => `<option value="${esc(e.ticker)}">${esc(e.ticker)} – ${esc(e.name)}</option>`).join('')}</select></div>
  <div class="card"><h2 id="dh"></h2><div id="dsig"></div>
    <div class="grid"><div><h2>Why you might buy</h2><ul class="tight" id="pros"></ul></div><div><h2>Why you might not</h2><ul class="tight" id="cons"></ul></div></div></div>
  <div class="card"><h2>What it holds</h2><div id="hold"></div><div class="chart" id="hw"><canvas id="c2" role="img" aria-label="Top holdings"></canvas></div><div class="sub" id="hs"></div></div>`;
  const q = id => el.querySelector('#' + id);
  barChart(q('c1'), sorted.map(e => e.ticker), sorted.map(e => +(ctx.metrics[e.ticker].drawdown_from_peak * 100).toFixed(1)), { title: '% below 3-year peak', fmt: v => v + '%', color: sorted.map(e => colour(sig[e.ticker].level)) });
  q('tbl').innerHTML = '<tr><th>Fund</th><th>Signal</th><th>Main reason</th></tr>' + sorted.map(e => `<tr><td><b>${esc(e.ticker)}</b></td><td class="${cls(sig[e.ticker].level)}"><b>${ICON[sig[e.ticker].level]} ${esc(sig[e.ticker].level)}</b></td><td>${esc(sig[e.ticker].reasons[0] || '')}</td></tr>`).join('');
  q('ff').value = funds.some(e => e.ticker === v0) ? v0 : funds[0].ticker;
  const draw = () => {
    const t = q('ff').value, e = ctx.etfs.find(x => x.ticker === t), s = sig[t];
    ctx.store.set('funds:t', t);
    const pc = prosCons({ etf: e, metrics: ctx.metrics[t], dividends: ctx.dividends[t], holdings: ctx.holdings[t] }, ctx.rules);
    q('dh').textContent = `${t}: ${s.level}`;
    q('dsig').innerHTML = `<div class="${cls(s.level)}"><b>${ICON[s.level]} ${esc(s.level)}</b> – ${esc(s.why)}</div>
      <ul class="tight">${s.reasons.map(r => `<li>${esc(r)}</li>`).join('')}</ul>
      ${s.dip.hit.length ? `<div class="sub">Buy-the-dip level reached: ${s.dip.hit.map(l => '-' + Math.round(-l * 100) + '%').join(', ')} (see Dips tab).</div>` : ''}
      <div class="sub">Price source: ${trustBadge(ctx.trust[t] && ctx.trust[t].price)}</div>`;
    q('pros').innerHTML = pc.pros.map(x => `<li>${esc(x)}</li>`).join('') || '<li>Nothing stands out from the data.</li>';
    q('cons').innerHTML = pc.cons.map(x => `<li>${esc(x)}</li>`).join('') || '<li>Nothing stands out from the data.</li>';
    const h = ctx.holdings[t];
    q('hold').textContent = e.notes || '';
    if (h && h.top && h.top.length) {
      q('hw').hidden = false;
      barChart(q('c2'), h.top.map(x => x.name), h.top.map(x => +(x.pct * 100).toFixed(1)), { title: '% of fund', fmt: v => v + '%' });
      q('hs').innerHTML = (h.feeder ? `This fund holds one underlying fund (${esc(h.underlying)}), so the list shows that, not the companies inside. ` : h.incomplete ? 'This list is partial (fund of funds), so concentration is not scored. ' : `Top 10 = ${fmtPct(h.top10_pct, 0)} of the fund. `)
        + (h.top_sector ? `Biggest sector: ${esc(String(h.top_sector.name).replace(/_/g, ' '))} ${fmtPct(h.top_sector.pct, 0)}. ` : '') + (h.as_of ? `As at ${esc(h.as_of)}. ` : '') + 'Source: ' + trustBadge(h.trust);
    } else { q('hw').hidden = true; q('hs').textContent = e.category === 'reference' ? 'A single company, so it is all one holding.' : 'Holdings data not available.'; }
  };
  q('ff').onchange = draw; draw();
}
