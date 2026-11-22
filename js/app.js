import { PASSCODE_HASH, APP_VERSION } from './config.js';
import { checkPasscode, isStale, makeStore } from './core.js';

const store = makeStore(window.localStorage || { getItem() { throw 0; }, setItem() { throw 0; } });
const TABS = [
  { id: 'today', label: 'Today', mod: './tab-today.js' },
];
const $ = id => document.getElementById(id);

async function loadData() {
  const get = n => fetch(`data/${n}.json`, { cache: 'no-cache' }).then(r => r.json());
  const [prices, metrics, scenarios, meta, trust] = await Promise.all(
    ['prices', 'metrics', 'scenarios', 'meta', 'trust'].map(get));
  const etfs = await fetch('config/etfs.json').then(r => r.json());
  const tax = await fetch('config/tax.json').then(r => r.json());
  return { prices, metrics, scenarios, meta, trust, etfs, tax };
}

async function show(ctx, id) {
  document.querySelectorAll('#nav button').forEach(b => b.setAttribute('aria-current', b.dataset.id === id));
  const t = TABS.find(x => x.id === id) || TABS[0];
  const view = $('view'); view.innerHTML = '';
  const mod = await import(t.mod);
  mod.render(view, ctx);
  store.set('tab', t.id);
}

async function start() {
  $('gate').hidden = true; $('app').hidden = false; $('ver').textContent = APP_VERSION;
  let ctx;
  try { ctx = { ...(await loadData()), store }; }
  catch (e) { $('view').textContent = 'Could not load data. Try again later.'; return; }
  const when = ctx.meta.updated_utc ? new Date(ctx.meta.updated_utc + 'Z') : null;
  $('updated').textContent = when ? 'Data updated ' + when.toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' }) : 'Data not yet updated';
  if (isStale(ctx.meta)) { $('stale').hidden = false; $('stale').textContent = 'Data is more than 3 days old. Prices below may be out of date.'; }
  else if (ctx.meta.failed && ctx.meta.failed.length) { $('stale').hidden = false; $('stale').textContent = 'Latest refresh failed for: ' + ctx.meta.failed.join(', ') + '. Showing last good data for these.'; }
  const nav = $('nav');
  TABS.forEach(t => { const b = document.createElement('button'); b.textContent = t.label; b.dataset.id = t.id; b.onclick = () => show(ctx, t.id); nav.appendChild(b); });
  show(ctx, store.get('tab', 'today'));
}

$('gateform').addEventListener('submit', async e => {
  e.preventDefault();
  if (await checkPasscode($('pass').value, PASSCODE_HASH)) { try { sessionStorage.setItem('etf:ok', '1'); } catch {} start(); }
  else $('gateerr').textContent = 'Incorrect passcode.';
});
let ok = false; try { ok = sessionStorage.getItem('etf:ok') === '1'; } catch {}
if (ok) start();
