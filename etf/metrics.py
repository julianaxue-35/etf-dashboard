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
