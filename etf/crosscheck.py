from __future__ import annotations
import json, urllib.request


def price_gap(a, b):
    return abs(a - b) / a


def crosscheck(ticker, primary_close, secondary_close, tol=0.005):
    if not primary_close or primary_close <= 0:
        return {"ok": None, "gap": None, "reason": "No usable primary price."}
    if secondary_close is None or secondary_close <= 0:
        return {"ok": None, "gap": None, "reason": "No second source available."}
    gap = price_gap(primary_close, secondary_close)
    return {"ok": gap <= tol, "gap": round(gap, 5), "reason": ""}


def asx_last_price(ticker, timeout=15):
    """Last price from the ASX website's own data service (undocumented; may change)."""
    url = f"https://asx.api.markitdigital.com/asx-research/1.0/companies/{ticker.lower()}/header"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return float(json.load(r)["data"]["priceLast"])
    except Exception:
        return None
