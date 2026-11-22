import { barChart } from './charts.js';
import { safeUrl, timeAgo, filterNews, affectsLabel, toneSummary } from './news.js';
import { trustBadge, esc } from './ui.js';

const PAGE = 12;

export function render(el, ctx) {
  const news = ctx.news || { items: [], by_topic: {}, topic_labels: {}, failed: [] };
  const funds = ctx.etfs.filter(e => e.category !== 'reference');
  const labels = news.topic_labels || {};
  const f0 = ctx.store.get('news:f', { ticker: 'all', topic: 'all' });
  const topics = Object.keys(news.by_topic || {}).sort((a, b) => news.by_topic[b] - news.by_topic[a]);
  const age = news.updated_utc ? (Date.now() - Date.parse(news.updated_utc + 'Z')) / 3600000 : Infinity;
  el.innerHTML = `
  <div class="takeaway" id="tk"></div>
  ${age > 48 ? '<div class="banner">News has not refreshed for over 2 days. Stories below may be out of date.</div>' : ''}
  ${news.failed && news.failed.length ? `<div class="sub">Could not reach: ${esc(news.failed.join(', '))}. Other sources are shown.</div>` : ''}
  <div class="card"><h2>Stories this week by theme</h2>
    <div class="chart" style="height:${Math.max(160, topics.length * 36)}px"><canvas id="c" role="img" aria-label="Number of stories by theme"></canvas></div>
    <div class="sub" id="tone"></div></div>
  <div class="card"><div class="row">
    <div><label for="nf">News affecting</label><select id="nf"><option value="all">All funds</option>${funds.map(e => `<option value="${esc(e.ticker)}">${esc(e.ticker)}</option>`).join('')}</select></div>
    <div><label for="nt">Theme</label><select id="nt"><option value="all">All themes</option>${topics.map(t => `<option value="${esc(t)}">${esc(labels[t] || t)}</option>`).join('')}</select></div></div>
    <div id="list"></div>
    <div class="sub"><button type="button" id="more" class="badge low" style="color:var(--brand)" hidden>Show more</button></div>
    <details class="more"><summary>More</summary><ul class="tight">
      <li>Headlines and links only; open the story to read it. Each story shows its source's trust score. "Reported by 2+" means another outlet carried the same story, which lifts the score.</li>
      <li>"Affects" and tone (falling / rising) are keyword guesses from the headline, not analysis. Use them to decide what to read, not what to buy or sell.</li>
      <li>Google News results are search listings: the headline's real outlet (shown as "via") is not checked.</li>
      <li>Updated ${news.updated_utc ? esc(timeAgo(news.updated_utc + 'Z')) : 'never'}; refreshed daily.</li></ul></details></div>`;
  const q = id => el.querySelector('#' + id);
  q('nf').value = funds.some(e => e.ticker === f0.ticker) ? f0.ticker : 'all';
  q('nt').value = topics.includes(f0.topic) ? f0.topic : 'all';
  if (topics.length) barChart(q('c'), topics.map(t => labels[t] || t), topics.map(t => news.by_topic[t]), { title: 'stories', fmt: v => Math.round(v) });
  let shown = PAGE;
  const draw = () => {
    const sel = { ticker: q('nf').value, topic: q('nt').value };
    ctx.store.set('news:f', sel);
    const list = filterNews(news.items, sel), tone = toneSummary(list);
    q('tk').textContent = news.items.length
      ? `${list.length} stor${list.length === 1 ? 'y' : 'ies'} ${sel.ticker === 'all' ? 'that could move your funds' : 'that could affect ' + sel.ticker} this week${tone.total ? `: ${tone.negative} sound negative, ${tone.positive} positive.` : '.'}`
      : 'No news available yet. It appears after the next daily refresh.';
    q('tone').textContent = tone.total ? `Of the ${tone.total} stories shown below: ${tone.negative} negative, ${tone.positive} positive, ${tone.neutral} neutral (keyword guess from headlines).` : '';
    q('list').innerHTML = list.slice(0, shown).map(i => `
      <div style="padding:10px 0;border-top:1px solid var(--line)">
        <div><a href="${esc(safeUrl(i.link))}" target="_blank" rel="noopener noreferrer"><b>${esc(i.title)}</b></a></div>
        <div class="sub">${esc(i.source)}${i.publisher ? ' via ' + esc(i.publisher) : ''} · ${esc(timeAgo(i.published))} · ${esc(i.tone)} ${trustBadge(i.trust)}
          ${i.reported_by > 1 ? ` · Reported by ${i.reported_by} sources` : ''}</div>
        <div class="sub">Affects: ${esc(affectsLabel(i.tickers, funds.length))}</div>
      </div>`).join('') || '<div class="sub">Nothing matches this filter.</div>';
    q('more').hidden = list.length <= shown;
  };
  q('nf').onchange = q('nt').onchange = () => { shown = PAGE; draw(); };
  q('more').onclick = () => { shown += PAGE; draw(); };
  draw();
}
