// Chart.js wrappers. Colours come from CSS variables so light/dark both work.
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
export const palette = () => ['--c1', '--c2', '--c3', '--c4', '--c5', '--c6'].map(css);

function base() {
  const ink = css('--muted'), line = css('--line');
  return { ink, line, opts: {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { labels: { color: css('--ink'), boxWidth: 12 } } },
    scales: { x: { ticks: { color: ink, maxTicksLimit: 8 }, grid: { color: line } },
              y: { ticks: { color: ink }, grid: { color: line } } } } };
}
const live = new WeakMap();
function mount(canvas, cfg) {
  const old = live.get(canvas); if (old) old.destroy();
  const c = new Chart(canvas, cfg); live.set(canvas, c); return c;
}

// series: [{label, dates, values}] rebased to 100 at the start
export function rebased(dates, prices) {
  return prices.length ? prices.map(p => (p / prices[0]) * 100) : [];
}
export function lineChart(canvas, series, yTitle) {
  const { opts } = base(); const pal = palette();
  opts.scales.y.title = { display: !!yTitle, text: yTitle, color: opts.scales.y.ticks.color };
  opts.elements = { point: { radius: 0 }, line: { borderWidth: 2 } };
  opts.interaction = { mode: 'index', intersect: false };
  const labels = series[0] ? series[0].dates : [];
  return mount(canvas, { type: 'line', data: { labels, datasets: series.map((s, i) => ({
    label: s.label, data: s.values, borderColor: pal[i % pal.length], backgroundColor: pal[i % pal.length],
    borderDash: i >= pal.length ? [5, 4] : [] })) }, options: opts });
}
export function barChart(canvas, labels, values, { color, title, horizontal = true, fmt = v => v } = {}) {
  const { opts } = base();
  opts.indexAxis = horizontal ? 'y' : 'x';
  opts.plugins.legend = { display: false };
  opts.plugins.tooltip = { callbacks: { label: c => fmt(c.parsed[horizontal ? 'x' : 'y']) } };
  const ax = horizontal ? 'x' : 'y';
  opts.scales[ax].title = { display: !!title, text: title, color: opts.scales[ax].ticks.color };
  opts.scales[ax].ticks.callback = v => fmt(v);
  return mount(canvas, { type: 'bar', data: { labels, datasets: [{ data: values, backgroundColor: color || palette()[0] }] }, options: opts });
}
// points: [{label, x, y, group}]; bands: {riskFree, targetLow, targetHigh}
export function scatterChart(canvas, points, groups, bands) {
  const { opts } = base(); const pal = palette();
  opts.scales.x.title = { display: true, text: 'Risk: volatility (how much it swings, % a year)', color: opts.scales.x.ticks.color };
  opts.scales.y.title = { display: true, text: 'Return: 3-year average % a year', color: opts.scales.y.ticks.color };
  opts.scales.x.ticks.callback = v => v + '%'; opts.scales.y.ticks.callback = v => v + '%';
  opts.scales.x.type = 'linear'; opts.scales.y.type = 'linear';
  opts.scales.x.suggestedMin = 5; opts.scales.y.suggestedMin = -10;
  opts.plugins.tooltip = { callbacks: { label: c => `${c.raw.label}: return ${c.raw.y.toFixed(1)}%, volatility ${c.raw.x.toFixed(1)}%` } };
  const band = { id: 'band', beforeDatasetsDraw(ch) {
    const { ctx, chartArea: a, scales: { y } } = ch; if (!bands) return;
    ctx.save();
    const y1 = y.getPixelForValue(bands.targetHigh), y2 = y.getPixelForValue(bands.targetLow);
    ctx.fillStyle = css('--brand') + '22'; ctx.fillRect(a.left, y1, a.right - a.left, y2 - y1);
    const yr = y.getPixelForValue(bands.riskFree); ctx.strokeStyle = css('--bad'); ctx.setLineDash([6, 4]);
    ctx.beginPath(); ctx.moveTo(a.left, yr); ctx.lineTo(a.right, yr); ctx.stroke();
    ctx.setLineDash([]); ctx.font = '11px system-ui'; ctx.textAlign = 'right';
    ctx.fillStyle = css('--bad'); ctx.fillText('6% no-risk rate', a.right - 6, yr + 13);
    ctx.fillStyle = css('--brand'); ctx.fillText('8–10% target', a.right - 6, y1 - 4); ctx.restore(); } };
  return mount(canvas, { type: 'scatter', plugins: [band],
    data: { datasets: groups.map((g, i) => ({ label: g, data: points.filter(p => p.group === g),
      backgroundColor: pal[i % pal.length], pointRadius: 6, pointStyle: ['circle', 'rect', 'triangle', 'rectRot', 'rectRounded'][i % 5] })) },
    options: opts });
}
