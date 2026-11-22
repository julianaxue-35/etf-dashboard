from etf.trust import trust_score, MAXES

def src(**kw):
    base = {"type": "primary", "scores": dict(MAXES), "reasons": {}}
    base.update(kw); return base

def test_perfect_source_with_crosscheck_is_100():
    r = trust_score(src(), True)
    assert r["score"] == 100 and r["reasons"] == []

def test_unofficial_aggregator_not_crosschecked_below_100_with_reasons():
    s = src(type="aggregator",
            scores={"primary": 15, "independent": 14, "transparent": 12, "timely": 13},
            reasons={"primary": "Unofficial feed that re-publishes exchange data.",
                     "transparent": "No published accuracy guarantee."})
    r = trust_score(s, None)
    assert r["score"] == 54
    text = " ".join(r["reasons"]).lower()
    assert "unofficial" in text and "not cross-checked" in text

def test_failed_crosscheck_flagged():
    r = trust_score(src(), False)
    assert r["score"] == 85 and any("disagree" in x.lower() for x in r["reasons"])

def test_opinion_capped_at_60():
    assert trust_score(src(type="opinion"), True)["score"] == 60
    assert any("opinion" in x.lower() for x in trust_score(src(type="opinion"), True)["reasons"])
