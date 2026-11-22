from etf.scenarios import scenario_bands

H = [0.5, 1, 3, 5, 10]

def _series(n, daily):
    return [daily + (0.01 if i % 2 else -0.01) * 0.5 for i in range(n)]

def test_same_seed_identical():
    r = _series(800, 0.0004)
    assert scenario_bands(r, H, n=300, seed=1) == scenario_bands(r, H, n=300, seed=1)

def test_percentiles_ordered():
    out = scenario_bands(_series(800, 0.0004), H, n=300)
    for h in H:
        b = out[h]
        assert b["p10"] <= b["p50"] <= b["p90"]

def test_zero_vol_probabilities():
    up = scenario_bands([0.0003] * 600, [1, 3], n=100)   # ~7.9%/yr
    assert up[1]["prob_beat_6"] == 1.0 and up[1]["prob_reach_10"] == 0.0
    down = scenario_bands([0.0001] * 600, [1, 3], n=100)  # ~2.5%/yr
    assert down[1]["prob_beat_6"] == 0.0

def test_limited_history():
    out = scenario_bands(_series(100, 0.0004), H, n=100)
    assert out["limited_history"] is True
    assert 0.5 in out and 1 in out and 3 not in out and 10 not in out

def test_one_year_history_allows_up_to_one_year():
    out = scenario_bands(_series(300, 0.0004), H, n=100)
    assert 1 in out and 3 not in out and out['limited_history'] is True


def test_loss_probabilities_and_deep_bad_case():
    down = scenario_bands([-0.0002] * 600, [1, 3], n=100)              # steady loser: always ends below the start
    assert down[1]["prob_loss"] == 1.0 and down[1]["prob_below_6"] == 1.0
    up = scenario_bands([0.0004] * 600, [1, 3], n=100)                 # steady winner: never loses
    assert up[1]["prob_loss"] == 0.0
    out = scenario_bands(_series(800, 0.0004), H, n=300)
    for h in H:
        assert out[h]["p5"] <= out[h]["p10"] <= out[h]["p50"]
        assert 0.0 <= out[h]["prob_loss"] <= out[h]["prob_below_6"] <= 1.0


def test_horizons_longer_than_the_funds_own_history_are_flagged():
    out = scenario_bands(_series(5 * 252, 0.0004), H, n=100)           # exactly 5 years of data
    assert out[5]["beyond_history"] is False and out[10]["beyond_history"] is True
    assert out[1]["beyond_history"] is False
