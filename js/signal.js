// Keep / Watch / Review signal and pros & cons. Rules-based and fully visible: every threshold
// comes from config/signal_rules.json and every reason names the number behind it.
// This is an indicator for a long-term investor, never an instruction to buy or sell.
import { dipStatus } from './dips.js';
import { fmtPct } from './ui.js';

const num = x => typeof x === 'number' && Number.isFinite(x);
const p0 = x => fmtPct(Math.abs(x), 0);
const sector = s => String(s || '').replace(/_/g, ' ');

export function fundSignal({ ticker, metrics, news, now = new Date(), dipLevels = [-0.15, -0.25, -0.35], trustPrice } = {}, rules) {
  if (!metrics || !num(metrics.drawdown_from_peak)) return { level: 'Unknown', reasons: ['Not enough data to judge.'], why: '', dip: { hit: [], next: null } };
  const dd = metrics.drawdown_from_peak, gap = metrics.ma200_gap, r12 = metrics.ret_12m;
  const watch = [], good = [];
  const days = metrics.last_date ? Math.floor((now.getTime() - Date.parse(metrics.last_date)) / 86400000) : null;
  if (num(days) && days > rules.stale_days) watch.push(`Price data is ${days} days old.`);
  if (trustPrice && trustPrice.crosscheck === false) watch.push('Price differs from a second source: check before acting.');
  if (dd <= rules.watch_drawdown) watch.push(`${p0(dd)} below its 3-year peak.`); else good.push(`Within ${p0(dd)} of its 3-year peak.`);
  if (num(gap) && gap < rules.watch_ma_gap) watch.push(`Price is ${p0(gap)} below its 200-day average (a downtrend).`); else if (num(gap) && gap >= 0) good.push('Above its 200-day average.');
  if (num(r12) && r12 < 0) watch.push(`Lost ${p0(r12)} over the last 12 months.`); else if (num(r12)) good.push(`Up ${p0(r12)} over the last 12 months.`);
  const negN = (news || []).filter(i => (i.tickers || []).includes(ticker) && i.tone === 'negative').length;
  if (negN >= rules.neg_news_watch) watch.push(`${negN} negative stories this week could affect it.`);
  const review = dd <= rules.review_drawdown && num(gap) && gap < 0 && num(r12) && r12 < 0;
  const level = review ? 'Review' : watch.length ? 'Watch' : 'Keep';
  const why = { Keep: 'Nothing here suggests changing a long-term plan.',
    Watch: 'Worth watching. On its own this is not a reason to sell.',
    Review: 'Check why it is falling and whether your reason for owning it still holds. This is not an instruction to sell.' }[level];
  return { level, reasons: watch.length ? watch : good, why, dip: dipStatus(dd, dipLevels) };
}

export function prosCons({ etf, metrics, dividends, holdings } = {}, rules) {
  const pros = [], cons = [];
  if (!etf) return { pros, cons };
  const fund = etf.category !== 'reference';
  const m = metrics || {}, d = dividends || {}, h = holdings || {};
  const region = etf.region || '';
  const fee = etf.fee_pct;
  if (fund && num(fee) && fee <= rules.low_fee) pros.push(`Low fee: ${fee.toFixed(2)}% a year.`);
  if (fund && num(fee) && fee >= rules.high_fee) cons.push(`Higher fee: ${fee.toFixed(2)}% a year, which eats into returns every year.`);
  if (num(h.top10_pct)) {
    if (h.top10_pct <= rules.wide_top10) pros.push(`Spread widely: its top 10 holdings are only ${p0(h.top10_pct)} of the fund.`);
    if (h.top10_pct >= rules.concentrated_top10) {
      const names = (h.top || []).slice(0, 2).map(t => `${t.name} ${p0(t.pct)}`).join(', ');
      cons.push(`Concentrated: its top 10 holdings are ${p0(h.top10_pct)} of the fund${names ? ` (${names})` : ''}.`);
    }
  }
  if (h.top_sector && num(h.top_sector.pct) && h.top_sector.pct >= rules.concentrated_sector) cons.push(`${p0(h.top_sector.pct)} sits in one sector: ${sector(h.top_sector.name)}.`);
  if (num(m.cagr_3y) && m.cagr_3y >= rules.target_low) pros.push(`Returned ${fmtPct(m.cagr_3y)} a year over 3 years, within or above your 8–10% target.`);
  if (num(m.cagr_3y) && m.cagr_3y < rules.savings_rate) cons.push(`Returned only ${fmtPct(m.cagr_3y)} a year over 3 years, below 6% savings.`);
  if (num(m.cagr_3y) && num(m.volatility_3y) && m.volatility_3y > 0 && m.cagr_3y / m.volatility_3y >= 1) pros.push(`Good return for its risk: ${(m.cagr_3y / m.volatility_3y).toFixed(1)} return per unit of volatility.`);
  if (num(m.volatility_3y) && m.volatility_3y >= rules.high_vol) cons.push(`Big swings: it typically moves about ${p0(m.volatility_3y)} a year up or down.`);
  if (num(m.max_drawdown_3y) && m.max_drawdown_3y <= rules.deep_fall) cons.push(`Fell ${p0(m.max_drawdown_3y)} at its worst in the last 3 years.`);
  if (num(m.history_years) && m.history_years >= rules.long_record_years) pros.push(`Long record: ${m.history_years.toFixed(0)} years of data.`);
  if (num(m.history_years) && m.history_years < rules.min_history_years) cons.push(`Short record: under 3 years of data (${m.history_years.toFixed(1)}), so risk figures are less reliable.`);
  if (num(d.ttm_yield) && d.ttm_yield >= rules.yield_pro) pros.push(`Pays about ${fmtPct(d.ttm_yield)} a year in cash distributions.`);
  const fr = d.franking ? d.franking.value : null;
  if (num(d.ttm_yield) && d.ttm_yield > 0 && num(fr) && fr >= rules.franked_pro) pros.push(`Dividends carry franking credits (about ${p0(fr)} franked).`);
  if (fund && ['global', 'us', 'global_hedged'].includes(region) && !(num(fr) && fr > 0)) cons.push('No franking credits: overseas shares do not carry them.');
  if (['global', 'us'].includes(region)) cons.push('Currency risk: overseas holdings are not hedged, so a rising Australian dollar can cut returns.');
  if (num(d.years_cut) && d.years_cut >= 2 && num(d.worst_yoy_change)) cons.push(`Payouts fell by more than 5% in ${d.years_cut} of the last ${d.cut_window_years || 10} years (worst drop ${p0(d.worst_yoy_change)}): dividends are not guaranteed.`);
  return { pros, cons };
}
