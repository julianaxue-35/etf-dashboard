"""Scenario bands by block-bootstrapping historical daily returns.
Outputs are ranges (p10/p50/p90 of the growth of 1.0), never point forecasts."""
from __future__ import annotations
import numpy as np

DAYS = 252


def scenario_bands(returns, horizons_years, start=1.0, n=5000, seed=1, block=21):
    r = np.asarray(returns, dtype=float)
    out = {}
    if len(r) < 20:
        return {"limited_history": True}
    # Horizons beyond 1 year need at least ~3 years of history to mean anything.
    limited = len(r) < 3 * DAYS
    rng = np.random.default_rng(seed)
    for h in horizons_years:
        if limited and h > 1:
            continue
        steps = max(1, int(round(h * DAYS)))
        b = min(block, len(r))
        nblocks = -(-steps // b)
        starts = rng.integers(0, len(r) - b + 1, size=(n, nblocks))
        idx = (starts[:, :, None] + np.arange(b)[None, None, :]).reshape(n, -1)[:, :steps]
        growth = np.prod(1.0 + r[idx], axis=1) * start
        ann = (growth / start) ** (1.0 / h) - 1.0
        out[h] = {
            "p5": float(np.percentile(growth, 5)),
            "p10": float(np.percentile(growth, 10)),
            "p50": float(np.percentile(growth, 50)),
            "p90": float(np.percentile(growth, 90)),
            "prob_loss": float(np.mean(growth < start)),
            "prob_below_6": float(np.mean(ann < 0.06)),
            "prob_beat_6": float(np.mean(ann > 0.06)),
            "prob_reach_8": float(np.mean(ann >= 0.08)),
            "prob_reach_10": float(np.mean(ann >= 0.10)),
        }
    if limited:
        out["limited_history"] = True
    return out
