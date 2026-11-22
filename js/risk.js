// Downside maths for the Risk tab.
export function gainNeeded(fall) {
  if (!(fall > 0 && fall < 1)) throw new Error('Fall must be between 0% and 100%.');
  return 1 / (1 - fall) - 1;
}

// Years to get back to even after a fall, at a steady yearly return. null if it never would.
export function recoveryYears(fall, annualReturn) {
  const g = gainNeeded(fall);
  if (!(annualReturn > 0)) return null;
  return Math.log(1 + g) / Math.log(1 + annualReturn);
}

export function afterFall(amount, fall) {
  if (!Number.isFinite(amount) || amount < 0) throw new Error('Amount cannot be negative.');
  if (!(fall > 0 && fall < 1)) throw new Error('Fall must be between 0% and 100%.');
  return amount * (1 - fall);
}

// Past-data probabilities understate crash risk, so never print a bare 0%.
export function lossLabel(p) {
  if (p === null || p === undefined || Number.isNaN(p)) return '–';
  return p < 0.005 ? 'under 1%' : Math.round(p * 100) + '%';
}

export function fmtDays(days) {
  if (days === null || days === undefined || Number.isNaN(days)) return '–';
  if (days <= 0) return 'none';
  if (days < 30) return 'under a month';
  const months = Math.round(days / 30.44), y = Math.floor(months / 12), m = months % 12;
  return 'about ' + [y ? `${y} yr${y === 1 ? '' : 's'}` : '', m ? `${m} mo` : ''].filter(Boolean).join(' ');
}
