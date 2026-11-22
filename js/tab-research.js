import { barChart } from './charts.js';
import { trustBadge, esc } from './ui.js';
import { safeUrl } from './news.js';

export function render(el, ctx) {
  const rk = ctx.rask, gh = ctx.tools;
  el.innerHTML = `
  <div class="takeaway">Rask is opinion and mostly sponsored. Treat it as ideas to test against this dashboard's data, not instructions.</div>
  <div class="card"><h2>At a glance</h2><div class="grid">
    <div><div class="sub"><b>Rask items by how much they promote</b></div><div class="chart" style="height:170px"><canvas id="c1" role="img" aria-label="Rask items by promotion level"></canvas></div></div>
    <div><div class="sub"><b>GitHub tools by verdict</b></div><div class="chart" style="height:170px"><canvas id="c2" role="img" aria-label="GitHub tools by verdict"></canvas></div></div></div></div>
  <div class="card"><h2>Rask podcast notes</h2>
    <div class="sub">Source: ${trustBadge(ctx.trust._rask)} · read ${esc(rk.retrieved)} · ${esc(rk.source_note)}</div>
    <h2 style="margin-top:12px">Common themes</h2><ul class="tight">${rk.themes.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
    <details class="more"><summary>Where this dashboard agrees or differs</summary><ul class="tight">
      <li>Overlap: A200 and VAS both hold the same big Australian companies (see Funds tab). Owning both adds little diversification.</li>
      <li>Regular investing: the Plan tab tests it on past prices, where a lump sum usually did better in a rising market.</li>
      <li>Costs: fees and brokerage are shown on Compare and Plan.</li>
      <li>Rask promotes products and fund issuers; the dashboard does not.</li></ul></details>
    <div id="eps"></div>
    <details class="more"><summary>Gaps in what I could read</summary><ul class="tight">${rk.gaps.map(g => `<li>${esc(g)}</li>`).join('')}</ul></details></div>
  <div class="card"><h2>GitHub tools for stock and trend analysis</h2>
    <div class="sub">Source: ${trustBadge(ctx.trust._github)} · ${esc(gh.source_note)}</div>
    <div class="tablewrap"><table id="gt" class="tw"></table></div></div>`;
  const level = i => (/^Explicit/.test(i.promo) ? 'Explicit' : /^Heavy/.test(i.promo) ? 'Heavy' : /^Moderate/.test(i.promo) ? 'Moderate' : 'Some');
  const verdict = t => (/^In use/.test(t.verdict) ? 'In use' : /^(Maybe|Worth)/.test(t.verdict) ? 'Maybe later' : /^Skip/.test(t.verdict) ? 'Skip' : 'Avoid');
  const tally = (list, f, order) => order.map(k => list.filter(x => f(x) === k).length);
  const lo = ['Explicit', 'Heavy', 'Moderate', 'Some'], vo = ['In use', 'Maybe later', 'Skip', 'Avoid'];
  barChart(el.querySelector('#c1'), lo, tally(rk.items, level, lo), { title: 'items', fmt: v => Math.round(v), color: '#c27c0e' });
  barChart(el.querySelector('#c2'), vo, tally(gh.items, verdict, vo), { title: 'tools', fmt: v => Math.round(v) });
  el.querySelector('#eps').innerHTML = rk.items.map(i => `<div style="padding:10px 0;border-top:1px solid var(--line)">
    <div><a href="${esc(safeUrl(i.url))}" target="_blank" rel="noopener noreferrer"><b>${esc(i.title)}</b></a></div>
    <div class="sub">${esc(i.date)} · ${esc(i.format)} · ${esc(i.read)}</div>
    <ul class="tight">${i.points.map(p => `<li>${esc(p)}</li>`).join('')}</ul>
    <div class="sub">Promotion: ${esc(i.promo)}</div></div>`).join('');
  el.querySelector('#gt').innerHTML = '<tr><th>Tool</th><th>What it does</th><th>Fit for you</th><th>Verdict</th></tr>' + gh.items.map(t => `<tr>
    <td><a href="${esc(safeUrl('https://github.com/' + String(t.repo).split(' ')[0]))}" target="_blank" rel="noopener noreferrer"><b>${esc(t.name)}</b></a><div class="sub">★ ${t.stars.toLocaleString('en-AU')} · updated ${esc(t.pushed)} · ${esc(t.license)}</div></td>
    <td>${esc(t.what)}</td><td>${esc(t.fit)}<div class="sub">Effort: ${esc(t.effort)}. ${esc(t.note)}</div></td><td><b>${esc(t.verdict)}</b></td></tr>`).join('');
}
