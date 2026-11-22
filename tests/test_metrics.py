import math
from etf.metrics import (daily_returns, cagr, annual_volatility, max_drawdown,
                         drawdown_from_peak, history_years, window)

def test_drawdown_basic():
    assert math.isclose(max_drawdown([100, 110, 99]), -0.1)
    assert math.isclose(drawdown_from_peak([100, 110, 99]), -0.1)

def test_drawdown_recovered_max_vs_current():
    p = [100, 50, 100]
    assert math.isclose(max_drawdown(p), -0.5)
    assert drawdown_from_peak(p) == 0.0

def test_constant_prices_zero_volatility():
    assert annual_volatility(daily_returns([100, 100, 100, 100])) == 0.0

def test_cagr_doubling_one_year():
    assert math.isclose(cagr([100, 200], 1.0), 1.0)

def test_too_short_returns_none():
    assert max_drawdown([100]) is None
    assert cagr([100], 1.0) is None
    assert annual_volatility([]) is None
    assert daily_returns([100]) == []

def test_bad_prices_dropped():
    r = daily_returns([100, 0, float("nan"), 110])
    assert len(r) == 1 and math.isclose(r[0], 0.1)

def test_history_years_and_window():
    d = ["2023-01-01", "2024-01-01", "2026-01-01"]
    assert math.isclose(history_years(d), 3.0, abs_tol=0.01)
    dd, pp = window(d, [1, 2, 3], 2.5)
    assert dd == ["2024-01-01", "2026-01-01"] and pp == [2, 3]
