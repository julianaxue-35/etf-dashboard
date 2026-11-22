// Australian tax estimates. Simplified on purpose: confirm with an accountant.
// Rules come from config/tax.json (year-stamped, checked against ato.gov.au).

function checkInputs({ principal, years, annualReturn }) {
  if (!Number.isFinite(principal) || principal < 0) throw new Error('Amount cannot be negative.');
  if (!Number.isFinite(years) || years <= 0) throw new Error('Number of years must be more than 0.');
  if (!Number.isFinite(annualReturn) || annualReturn <= -1) throw new Error('Return must be greater than -100%.');
}

function medicare(income, rules) {
  const lo = rules.medicare_low_threshold, hi = rules.medicare_full_threshold;
  if (income <= lo) return 0;
  if (income < hi) return (income - lo) * 0.10;     // phase-in: 10c per $ above the low threshold
  return income * rules.medicare;
}

export function incomeTax(taxable, rules) {
  if (!(taxable > 0)) return 0;
  let tax = 0, prev = 0;
  for (const b of rules.brackets) {
    const top = b.upTo === null ? Infinity : b.upTo;
    if (taxable > prev) tax += (Math.min(taxable, top) - prev) * b.rate;
    prev = top;
  }
  return tax + medicare(taxable, rules);
}

// cgtRule 'current' = 50% discount after 12 months. 'indexed' = proposed cost-base indexation
// (announced in the 2026-27 Budget, not yet law; assumes all of the gain accrues after 1 Jul 2027).
export function cgtOnSale({ gain, heldMonths, otherIncome = 0, costBase = 0, cgtRule = 'current', cpi }, rules) {
  if (!(gain > 0)) return 0;
  let taxableGain;
  if (cgtRule === 'indexed') {
    const rate = cpi ?? rules.cpi_default;
    const years = heldMonths / 12;
    taxableGain = Math.max(0, gain - costBase * (Math.pow(1 + rate, years) - 1));
  } else {
    taxableGain = heldMonths >= rules.cgt_discount_months ? gain * (1 - rules.cgt_discount) : gain;
  }
  return incomeTax(otherIncome + taxableGain, rules) - incomeTax(otherIncome, rules);
}

export function afterTaxOutcome({ principal, annualReturn, years, yieldPct = 0, frankingPct = 0, otherIncome = 0, saleIncome = otherIncome, cgtRule = 'current', cpi }, rules) {
  checkInputs({ principal, years, annualReturn });
  let value = principal, cost = principal, taxDist = 0, left = years;
  const corp = 0.30;
  while (left > 1e-9) {
    const dt = Math.min(1, left); left -= dt;
    const dist = value * yieldPct * dt;
    const credit = dist * (corp / (1 - corp)) * frankingPct;
    const assessable = dist + credit;
    const tax = incomeTax(otherIncome + assessable, rules) - incomeTax(otherIncome, rules) - credit;   // negative = refund
    taxDist += tax;
    value = value * Math.pow(1 + annualReturn, dt) - tax;
    cost += dist - tax;
  }
  const gross = principal * Math.pow(1 + annualReturn, years);
  const cgt = cgtOnSale({ gain: value - cost, heldMonths: years * 12, otherIncome: saleIncome, costBase: cost, cgtRule, cpi }, rules);
  return { gross, tax_on_distributions: taxDist, cgt, net: value - cgt };
}

// Super. Money from after-tax savings (non-concessional) pays no contributions tax; money salary-sacrificed
// from pre-tax pay (preTax: true) is taxed 15% on the way in. Earnings taxed 15% while saving, 0% once drawn after 60.
export function superOutcome({ principal, annualReturn, years, preTax = false }, rules) {
  checkInputs({ principal, years, annualReturn });
  const start = preTax ? principal * (1 - rules.super_contrib_tax) : principal;
  const net = start * Math.pow(1 + annualReturn * (1 - rules.super_earnings_tax), years);
  return { gross: principal * Math.pow(1 + annualReturn, years), net };
}
