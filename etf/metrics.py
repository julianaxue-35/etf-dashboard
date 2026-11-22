"""Pure functions on price series. Prices are auto-adjusted closes (total return)."""
from __future__ import annotations
import math
from datetime import date


def _clean(prices):
    return [p for p in prices if p is not None and not math.isnan(p) and p > 0]


def daily_returns(prices):
    p = _clean(prices)
    return [p[i] / p[i - 1] - 1 for i in range(1, len(p))]


def cagr(prices, years):
    p = _clean(prices)
    if len(p) < 2 or not years or years <= 0:
        return None
    return (p[-1] / p[0]) ** (1 / years) - 1


def annual_volatility(returns):
    if len(returns) < 2:
        return None
    m = sum(returns) / len(returns)
    var = sum((r - m) ** 2 for r in returns) / (len(returns) - 1)
    return math.sqrt(var) * math.sqrt(252)


def max_drawdown(prices):
    p = _clean(prices)
    if len(p) < 2:
        return None
    peak, worst = p[0], 0.0
    for x in p:
        peak = max(peak, x)
        worst = min(worst, x / peak - 1)
    return worst


def drawdown_from_peak(prices):
    p = _clean(prices)
    if len(p) < 2:
        return None
    return p[-1] / max(p) - 1


def history_years(dates):
    if len(dates) < 2:
        return 0.0
    a, b = date.fromisoformat(dates[0][:10]), date.fromisoformat(dates[-1][:10])
    return (b - a).days / 365.25


def window(dates, prices, years):
    if not dates:
        return [], []
    end = date.fromisoformat(dates[-1][:10])
    keep = [i for i, d in enumerate(dates)
            if (end - date.fromisoformat(d[:10])).days <= years * 365.25]
    return [dates[i] for i in keep], [prices[i] for i in keep]


def rolling_summary(prices, window=252, floor=0.06):
    """Return over every `window`-day stretch: worst, best, median, share negative, share below `floor`."""
    p = _clean(prices)
    if window < 1 or len(p) <= window:
        return None
    r = sorted(p[i + window] / p[i] - 1 for i in range(len(p) - window))
    n = len(r)
    return {"worst": r[0], "best": r[-1], "median": r[n // 2],
            "pct_negative": sum(1 for x in r if x < 0) / n,
            "pct_below": sum(1 for x in r if x < floor) / n, "windows": n}


def longest_underwater_days(dates, prices):
    """Longest stretch (calendar days) from a peak until the price got back to that peak
    (or to the last date if it has not recovered yet)."""
    pairs = [(d, p) for d, p in zip(dates, prices) if p is not None and not math.isnan(p) and p > 0]
    if len(pairs) < 2:
        return None
    peak_p, peak_d = pairs[0][1], date.fromisoformat(pairs[0][0][:10])
    longest, below = 0, False
    for d, p in pairs[1:]:
        dd = date.fromisoformat(d[:10])
        if p < peak_p:
            below = True
            longest = max(longest, (dd - peak_d).days)
        else:
            if below:
                longest = max(longest, (dd - peak_d).days)
            below, peak_p, peak_d = False, p, dd
    return longest
