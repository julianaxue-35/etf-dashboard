from etf.crosscheck import price_gap, crosscheck

def test_gap_within_tolerance():
    assert abs(price_gap(100, 100.4) - 0.004) < 1e-9
    assert crosscheck("A", 100, 100.4)["ok"] is True

def test_gap_outside_tolerance():
    r = crosscheck("A", 100, 101)
    assert r["ok"] is False and r["gap"] > 0.005

def test_missing_secondary_is_none_not_true():
    r = crosscheck("A", 100, None)
    assert r["ok"] is None and "no second" in r["reason"].lower()

def test_zero_primary_is_none():
    assert crosscheck("A", 0, 100)["ok"] is None
