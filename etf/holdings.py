"""Concentration facts for a fund: share held in its top holdings and its biggest sector."""
from __future__ import annotations
import math


def _ok(x):
    return isinstance(x, (int, float)) and not math.isnan(x) and x > 0


def summarize(rows, sectors):
    good = [(str(n), float(p)) for n, p in (rows or []) if _ok(p)]
    if not good:
        return None
    sec = [(k, float(v)) for k, v in (sectors or {}).items() if _ok(v)]
    top_sector = max(sec, key=lambda kv: kv[1]) if sec else None
    total = sum(p for _, p in good[:10])
    feeder = good[0][1] >= 0.90                      # holds one underlying fund: top-10 share is meaningless
    incomplete = (not feeder) and len(good) < 8 and total < 0.90   # fund of funds / partial listing
    return {"top10_pct": None if (feeder or incomplete) else total,
            "feeder": feeder, "incomplete": incomplete, "underlying": good[0][0] if feeder else None,
            "top": [{"name": n, "pct": p} for n, p in good[:10]],
            "top_sector": {"name": top_sector[0], "pct": top_sector[1]} if top_sector else None,
            "n_listed": len(good)}
