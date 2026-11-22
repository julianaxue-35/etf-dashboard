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

def test_trust_file_written_with_reasons(tmp_path):
    from etf.provider import FakeProvider
    etfs = [{"ticker": "AAA", "category": "core", "fee_pct": 0.1, "fee_verified": True,
             "fee_check": "issuer_page"}]
    sources = {"yahoo": {"type": "aggregator", "scores": {"primary": 15, "independent": 14,
               "transparent": 10, "timely": 13}, "reasons": {}},
               "issuer": {"type": "issuer", "scores": {"primary": 30, "independent": 12,
               "transparent": 18, "timely": 13}, "reasons": {}},
               "issuer_search": {"type": "issuer", "scores": {"primary": 30, "independent": 12,
               "transparent": 14, "timely": 12}, "reasons": {}},
               "asx": {"type": "primary", "scores": {"primary": 30, "independent": 18,
               "transparent": 10, "timely": 14}, "reasons": {}}}
    fetch.run(FakeProvider({"AAA": series()}), etfs, tmp_path, NOW,
              sources=sources, second_price=lambda t: 0.0)  # bad second price -> mismatch
    t = json.loads((tmp_path / "trust.json").read_text())["AAA"]
    assert t["price"]["score"] < 100 and t["price"]["reasons"]
    assert t["facts"]["score"] <= 100

def test_second_price_none_gives_not_crosschecked(tmp_path):
    etfs = [{"ticker": "AAA", "category": "core", "fee_pct": 0.1, "fee_check": "issuer_page"}]
    fetch.run(FakeProvider({"AAA": series()}), etfs, tmp_path, NOW, sources=None,
              second_price=lambda t: None)
    t = json.loads((tmp_path / "trust.json").read_text())["AAA"]
    assert t["price"]["crosscheck"] is None

def test_price_mismatch_flagged(tmp_path):
    etfs = [{"ticker": "AAA", "category": "core", "fee_pct": 0.1, "fee_check": "n/a"}]
    fetch.run(FakeProvider({"AAA": series()}), etfs, tmp_path, NOW, second_price=lambda t: 1.0)
    t = json.loads((tmp_path / "trust.json").read_text())["AAA"]
    assert t["price"]["crosscheck"] is False
    assert any("differs" in r for r in t["price"]["reasons"]) and t["facts"] is None
