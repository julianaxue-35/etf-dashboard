// Contribution and buying-plan maths. Monthly rate = effective annual rate converted to monthly.
const mrate = a => Math.pow(1 + a, 1 / 12) - 1;

export function monthlyNeeded({ goal, startBalance = 0, years, annualReturn }) {
  if (!Number.isFinite(years) || years <= 0) return { value: null, reason: 'Number of years must be more than 0.' };
  if (years > 100) return { value: null, reason: 'Number of years must be 100 or fewer.' };
  if (!Number.isFinite(goal) || goal < 0) return { value: null, reason: 'Goal must be 0 or more.' };
  if (!Number.isFinite(startBalance) || startBalance < 0) return { value: null, reason: 'Starting amount cannot be negative.' };
  if (!Number.isFinite(annualReturn) || annualReturn <= -1) return { value: null, reason: 'Return must be greater than -100%.' };
  const n = Math.round(years * 12);
  if (n < 1) return { value: null, reason: 'Number of years must be at least one month.' };
  const rm = mrate(annualReturn);
  if (Math.abs(rm) < 1e-12) return { value: Math.max(0, (goal - startBalance) / n) };
  const g = Math.pow(1 + rm, n);
  const gap = goal - startBalance * g;
  return { value: gap <= 0 ? 0 : (gap * rm) / (g - 1) };
}

export function balanceAt({ startBalance, monthly, annualReturn, months }) {
  const rm = mrate(annualReturn);
  if (Math.abs(rm) < 1e-12) return startBalance + monthly * months;
  const g = Math.pow(1 + rm, months);
  return startBalance * g + monthly * (g - 1) / rm;
}

// Final value of $1 at the end of the window: all in on day one vs 1/months bought at each of
// `months` evenly spaced points, with not-yet-invested cash earning 0%.
export function dcaVsLump(prices, months = 12) {
  const L = prices.length;
  if (L < 2 || L < months || prices.some(p => !(p > 0))) return null;
  const end = prices[L - 1];
  const lump = end / prices[0];
  let units = 0;
  for (let k = 0; k < months; k++) units += (1 / months) / prices[Math.round((k * (L - 1)) / months)];
  return { lump, dca: units * end };
}

// Slide a 12-month window along the price history (weekly points) and summarise.
export function rollingDca(prices, months = 12, pointsPerYear = 52) {
  const len = Math.round((months / 12) * pointsPerYear) + 1;
  if (prices.length < len + 1) return null;
  const diffs = [], lumps = [], dcas = [];
  let dcaWins = 0;
  for (let s = 0; s + len <= prices.length; s++) {
    const r = dcaVsLump(prices.slice(s, s + len), months);
    if (!r) continue;
    diffs.push(r.lump / r.dca - 1); lumps.push(r.lump); dcas.push(r.dca);
    if (r.dca > r.lump) dcaWins++;
  }
  if (!diffs.length) return null;
  const med = a => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
  const medianLump = med(lumps), medianDca = med(dcas);
  diffs.sort((a, b) => a - b);
  return { medianLump, medianDca, windows: diffs.length, dcaWinRate: dcaWins / diffs.length, medianDiff: diffs[Math.floor(diffs.length / 2)], worstLumpDiff: diffs[0], bestLumpDiff: diffs[diffs.length - 1] };
}

// Spread a lump sum over `months` equal monthly buys. Rounding pennies go to the last buy.
export function buildSchedule({ amount, months = 12, start, brokerage = 0 }) {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Amount must be more than $0.');
  if (!Number.isInteger(months) || months < 1 || months > 60) throw new Error('Months must be a whole number from 1 to 60.');
  if (!Number.isFinite(brokerage) || brokerage < 0) throw new Error('Brokerage cannot be negative.');
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(start || '');
  if (!m) throw new Error('Start date must look like 2026-12-01.');
  const [y0, mo0, d0] = [+m[1], +m[2] - 1, +m[3]];
  const each = Math.floor((amount / months) * 100) / 100;
  const rows = []; let cum = 0;
  for (let k = 0; k < months; k++) {
    const buy = k === months - 1 ? Math.round((amount - each * (months - 1)) * 100) / 100 : each;
    cum = Math.round((cum + buy) * 100) / 100;
    const total = mo0 + k, y = y0 + Math.floor(total / 12), mo = total % 12;
    const dim = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
    const date = `${y}-${String(mo + 1).padStart(2, '0')}-${String(Math.min(d0, dim)).padStart(2, '0')}`;
    rows.push({ n: k + 1, date, buy, brokerage, cumulative: cum });
  }
  const totalBrokerage = brokerage * months;
  return { rows, totalBrokerage, brokeragePct: totalBrokerage / amount };
}
