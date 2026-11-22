"""Source trust score out of 100. A transparent rubric, not objective truth.
Parts: primary 30, independent 20, transparent 20, timely 15, cross-checked 15."""
from __future__ import annotations

MAXES = {"primary": 30, "independent": 20, "transparent": 20, "timely": 15}
CROSS_MAX = 15
DEFAULT_REASON = {
    "primary": "Not the original source of the data.",
    "independent": "Not fully independent (may have a commercial interest).",
    "transparent": "Method or accuracy record not fully published.",
    "timely": "May be delayed or out of date.",
}


def trust_score(source, crosscheck_ok):
    total, reasons = 0, []
    for part, mx in MAXES.items():
        got = min(mx, source["scores"].get(part, 0))
        total += got
        if got < mx:
            reasons.append(source.get("reasons", {}).get(part) or DEFAULT_REASON[part])
    if crosscheck_ok is True:
        total += CROSS_MAX
    elif crosscheck_ok is False:
        reasons.append("Disagrees with a second source: treat with caution.")
    else:
        reasons.append("Not cross-checked against a second source.")
    if source.get("type") == "opinion":
        total = min(total, 60)
        reasons.append("Opinion, not data: capped at 60.")
    return {"score": int(total), "reasons": reasons}
