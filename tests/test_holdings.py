from etf.holdings import summarize

def test_summarize_basic():
    rows = [("BHP", 0.11), ("CBA", 0.104), ("NAB", 0.049)] + [(f"X{i}", 0.03) for i in range(7)]
    s = summarize(rows, {"financial_services": 0.36, "basic_materials": 0.24, "zero": 0.0})
    assert abs(s["top10_pct"] - 0.473) < 1e-9
    assert s["top"][0] == {"name": "BHP", "pct": 0.11} and len(s["top"]) == 10
    assert s["top_sector"] == {"name": "financial_services", "pct": 0.36}

def test_summarize_edge_cases():
    assert summarize([], {}) is None
    assert summarize(None, None) is None
    s = summarize([("A", 0.5)], None)
    assert s["top_sector"] is None and s["incomplete"] is True and s["top"][0]["pct"] == 0.5
    s2 = summarize([("A", float("nan")), ("B", 0.2), ("C", -1)], {"t": float("nan")})
    assert s2["top"] == [{"name": "B", "pct": 0.2}] and s2["top_sector"] is None          # bad numbers ignored


def test_feeder_and_incomplete_funds_are_flagged_not_misreported():
    feeder = summarize([("iShares Core S&P 500 ETF", 0.998)], {"technology": 0.3})
    assert feeder["feeder"] is True and feeder["top10_pct"] is None and feeder["underlying"].startswith("iShares")
    fof = summarize([("Vanguard Aus Shares", 0.099), ("Vanguard Intl", 0.053), ("Vanguard Global Agg", 0.034), ("Other", 0.025)], {})
    assert fof["incomplete"] is True and fof["top10_pct"] is None
    full = summarize([(f"S{i}", 0.05) for i in range(10)], {})
    assert not full.get("feeder") and not full.get("incomplete") and abs(full["top10_pct"] - 0.5) < 1e-9
