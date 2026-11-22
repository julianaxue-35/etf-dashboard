import json, datetime as dt
import pytest
from etf.provider import FakeProvider, ProviderError
import fetch

ETFS = [{"ticker": "AAA", "category": "core", "fee_pct": 0.1},
        {"ticker": "BBB", "category": "tech", "fee_pct": 0.5}]
NOW = dt.datetime(2026, 11, 22, 20, 0)

def series(n=1000, drift=0.0004):
    start = dt.date(2022, 1, 1)
    dates, closes, p = [], [], 100.0
    for i in range(n):
        p *= 1 + drift + (0.006 if i % 2 else -0.006)
        dates.append((start + dt.timedelta(days=i)).isoformat()); closes.append(p)
    return dates, closes

def test_all_good(tmp_path):
    prov = FakeProvider({"AAA": series(), "BBB": series(drift=0.0002)})
    fetch.run(prov, ETFS, tmp_path, NOW)
    for f in ("prices", "metrics", "scenarios", "meta"):
        assert (tmp_path / f"{f}.json").exists()
    m = json.loads((tmp_path / "metrics.json").read_text())
    assert {"cagr_1y", "cagr_3y", "volatility_3y", "max_drawdown_3y",
            "drawdown_from_peak", "history_years", "fee_pct", "category",
            "last_close", "last_date"} <= set(m["AAA"])
    assert json.loads((tmp_path / "meta.json").read_text())["failed"] == []

def test_one_failure_preserves_old(tmp_path):
    fetch.run(FakeProvider({"AAA": series(), "BBB": series()}), ETFS, tmp_path, NOW)
    old = json.loads((tmp_path / "metrics.json").read_text())["BBB"]
    fetch.run(FakeProvider({"AAA": series(drift=0.0006)}), ETFS, tmp_path, NOW)
    m = json.loads((tmp_path / "metrics.json").read_text())
    assert m["BBB"] == old and m["AAA"]
    assert json.loads((tmp_path / "meta.json").read_text())["failed"] == ["BBB"]

def test_all_fail_untouched(tmp_path):
    fetch.run(FakeProvider({"AAA": series(), "BBB": series()}), ETFS, tmp_path, NOW)
    before = (tmp_path / "metrics.json").read_text()
    fetch.run(FakeProvider({}), ETFS, tmp_path, NOW)
    assert (tmp_path / "metrics.json").read_text() == before
    assert sorted(json.loads((tmp_path / "meta.json").read_text())["failed"]) == ["AAA", "BBB"]

def test_short_history_flagged(tmp_path):
    fetch.run(FakeProvider({"AAA": series(200), "BBB": series(200)}), ETFS, tmp_path, NOW)
    m = json.loads((tmp_path / "metrics.json").read_text())["AAA"]
    assert m["cagr_3y"] is None and m["limited_history"] is True
