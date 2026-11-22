"""Summarise a fund's distribution history (cash paid per unit)."""
from __future__ import annotations
import math
from datetime import date, datetime


CUT_TOLERANCE = 0.05


def _d(s):
    return date.fromisoformat(s[:10])


def summarize(divs, last_close, now):
    today = now.date() if isinstance(now, datetime) else now
    clean = sorted((d, float(a)) for d, a in divs
                   if a is not None and not math.isnan(a) and a > 0 and _d(d) <= today)
    ttm = [(d, a) for d, a in clean if 0 <= (today - _d(d)).days <= 365]
    amount = sum(a for _, a in ttm)
    n = len(ttm)
    freq = ("Monthly" if n >= 10 else "Quarterly" if n >= 3 else "Half-yearly" if n == 2
            else "Yearly" if n == 1 else "None")
    by_year = {}
    for d, a in clean:
        by_year[_d(d).year] = by_year.get(_d(d).year, 0.0) + a
    # complete calendar years in the last 10 years only (same window as the price/risk figures)
    full = [(y, v) for y, v in sorted(by_year.items()) if today.year - 10 <= y < today.year]
    changes = [full[i][1] / full[i - 1][1] - 1 for i in range(1, len(full))
               if full[i][0] == full[i - 1][0] + 1 and full[i - 1][1] > 0]
    last = clean[-1] if clean else None
    return {
        "ttm_amount": round(amount, 6),
        "ttm_yield": (amount / last_close) if last_close and last_close > 0 else None,
        "payments_ttm": n, "frequency": freq,
        "last_date": last[0][:10] if last else None, "last_amount": last[1] if last else None,
        "worst_yoy_change": min(changes) if changes else None,
        "years_cut": sum(1 for c in changes if c < -CUT_TOLERANCE),     # tiny dips (currency rounding) are not cuts
        "cut_window_years": 10,
        "recent": [{"date": d[:10], "amount": round(a, 4)} for d, a in clean[-6:]],
        "by_year": [{"year": y, "amount": round(v, 4)} for y, v in sorted(by_year.items())][-6:],
    }
