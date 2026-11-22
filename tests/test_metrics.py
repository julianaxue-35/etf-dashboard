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


from etf.metrics import rolling_summary, longest_underwater_days

def test_rolling_summary():
    s = rolling_summary([100, 50, 100, 200], 1)          # returns: -50%, +100%, +100%
    assert s["worst"] == -0.5 and s["best"] == 1.0
    assert abs(s["pct_negative"] - 1 / 3) < 1e-9 and abs(s["pct_below"] - 1 / 3) < 1e-9
    assert rolling_summary([100, 101], 5) is None          # not enough history for the window
    assert rolling_summary([100], 1) is None

def test_longest_underwater_days():
    d = ["2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04", "2026-01-05"]
    assert longest_underwater_days(d, [100, 110, 99, 105, 112]) == 3      # peak Jan 2 -> new high Jan 5
    assert longest_underwater_days(d, [100, 101, 102, 103, 104]) == 0     # never below a prior peak
    assert longest_underwater_days(d, [100, 110, 90, 80, 85]) == 3        # still under water at the end (Jan 2 -> Jan 5)
    assert longest_underwater_days(["2026-01-01"], [100]) is None


from etf.metrics import ma_gap, trailing_return

def test_ma_gap_and_trailing_return():
    p = list(range(1, 11))                                  # 1..10
    assert abs(ma_gap(p, 5) - (10 / 8 - 1)) < 1e-9          # mean of last 5 = 8
    assert ma_gap([1, 2], 5) is None
    assert abs(trailing_return([100, 110, 121], 2) - 0.21) < 1e-9
    assert trailing_return([100, 110], 5) is None
    assert ma_gap([0, 0, 0], 2) is None                     # bad prices dropped -> not enough data
