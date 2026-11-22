"""Summarise a fund's distribution history (cash paid per unit)."""
from __future__ import annotations
import math
from datetime import date, datetime


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
    last = clean[-1] if clean else None
    return {
        "ttm_amount": round(amount, 6),
        "ttm_yield": (amount / last_close) if last_close and last_close > 0 else None,
        "payments_ttm": n, "frequency": freq,
        "last_date": last[0][:10] if last else None, "last_amount": last[1] if last else None,
        "recent": [{"date": d[:10], "amount": round(a, 4)} for d, a in clean[-6:]],
        "by_year": [{"year": y, "amount": round(v, 4)} for y, v in sorted(by_year.items())][-6:],
    }
