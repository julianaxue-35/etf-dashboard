import datetime as dt
from etf.dividends import summarize

NOW = dt.datetime(2026, 11, 22)

def test_quarterly_ttm_and_yield():
    divs = [("2025-10-01", 1.5), ("2026-01-02", 1.0), ("2026-04-01", 1.0), ("2026-07-01", 1.0), ("2026-10-01", 1.5)]
    s = summarize(divs, 100.0, NOW)
    assert abs(s["ttm_amount"] - 4.5) < 1e-9          # Oct 2025 is outside the 365-day window
    assert abs(s["ttm_yield"] - 0.045) < 1e-9
    assert s["payments_ttm"] == 4 and s["frequency"] == "Quarterly"
    assert s["last_date"] == "2026-10-01" and s["last_amount"] == 1.5

def test_frequency_labels():
    mk = lambda n: [(f"2026-{m:02d}-15", 0.1) for m in range(1, n + 1)]
    assert summarize(mk(12), 10, NOW)["frequency"] == "Monthly"
    assert summarize([("2026-03-10", 1), ("2026-09-09", 1)], 100, NOW)["frequency"] == "Half-yearly"
    assert summarize([("2026-03-10", 1)], 100, NOW)["frequency"] == "Yearly"

def test_none_future_and_bad_inputs():
    s = summarize([], 100.0, NOW)
    assert s["ttm_amount"] == 0 and s["ttm_yield"] == 0 and s["frequency"] == "None" and s["last_date"] is None
    f = summarize([("2027-01-01", 5.0)], 100.0, NOW)          # future dates ignored
    assert f["ttm_amount"] == 0
    assert summarize([("2026-07-01", 1.0)], 0, NOW)["ttm_yield"] is None   # no price -> no yield, no crash
    assert summarize([("2026-07-01", -1.0), ("2026-07-02", float("nan"))], 100, NOW)["ttm_amount"] == 0

def test_yearly_history():
    divs = [("2024-03-01", 1.0), ("2024-09-01", 1.0), ("2025-03-01", 2.0), ("2026-03-01", 3.0)]
    s = summarize(divs, 100, NOW)
    assert s["by_year"][-3:] == [{"year": 2024, "amount": 2.0}, {"year": 2025, "amount": 2.0}, {"year": 2026, "amount": 3.0}]
