import json, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
CATS = {"core", "tech", "healthcare", "infrastructure", "reference"}

def test_every_etf_has_required_fields():
    etfs = json.loads((ROOT / "config/etfs.json").read_text())
    assert etfs
    for e in etfs:
        for k in ("ticker", "name", "category", "fee_pct", "notes"):
            assert k in e, (e.get("ticker"), k)
        assert e["category"] in CATS
    assert len({e["ticker"] for e in etfs}) == len(etfs)

def test_tax_brackets_ascending():
    t = json.loads((ROOT / "config/tax.json").read_text())
    ups = [b["upTo"] for b in t["brackets"][:-1]]
    assert ups == sorted(ups)
    assert t["brackets"][-1]["upTo"] is None
    assert t["brackets"][0]["rate"] == 0
