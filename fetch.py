"""Daily pipeline: fetch -> metrics -> scenarios -> write data/*.json.
Failures never wipe good data: a failed ticker keeps its previous entry."""
from __future__ import annotations
import json, pathlib, sys
from etf import metrics as M
from etf.scenarios import scenario_bands
from etf.provider import YahooProvider, ProviderError
from etf.trust import trust_score
from etf.crosscheck import crosscheck, asx_last_price
from etf.dividends import summarize
from etf.holdings import summarize as summarize_holdings
from etf import news as newsmod

ROOT = pathlib.Path(__file__).resolve().parent
HORIZONS = [0.5, 1, 3, 5, 10]


def _load(path):
    try:
        return json.loads(pathlib.Path(path).read_text())
    except Exception:
        return {}


def _entry(etf, dates, closes):
    d3, p3 = M.window(dates, closes, 3)
    d1, p1 = M.window(dates, closes, 1)
    hy = M.history_years(dates)
    r3 = M.daily_returns(p3)

    def cg(win_years):
        if hy < win_years * 0.95:
            return None
        _, p = M.window(dates, closes, win_years)
        return M.cagr(p, M.history_years(_))
    metrics = {
        "category": etf["category"], "fee_pct": etf.get("fee_pct"),
        "cagr_1y": cg(1), "cagr_3y": cg(3), "cagr_5y": cg(5), "cagr_10y": cg(10),
        "volatility_3y": M.annual_volatility(r3),
        "max_drawdown_3y": M.max_drawdown(p3),
        "drawdown_from_peak": M.drawdown_from_peak(p3),
        "history_years": round(hy, 2), "limited_history": hy < 3,
        "last_close": closes[-1], "last_date": dates[-1],
    }
    metrics.update({"ma200_gap": M.ma_gap(closes, 200), "ret_12m": M.trailing_return(closes, 252)})
    rs = M.rolling_summary(closes, 252, 0.06)          # every 12-month stretch in the full history (up to 10 years)
    metrics.update({"worst_12m": rs and rs["worst"], "best_12m": rs and rs["best"], "median_12m": rs and rs["median"],
                    "pct_12m_negative": rs and rs["pct_negative"], "pct_12m_below_6": rs and rs["pct_below"],
                    "longest_underwater_days": M.longest_underwater_days(dates, closes)})
    scen = scenario_bands(M.daily_returns(closes), HORIZONS)
    scen = {str(k): v for k, v in scen.items()}
    # weekly points for the last 3 years keeps the file small
    price = {"d": d3[::5] + ([d3[-1]] if (len(d3) - 1) % 5 else []),
             "p": [round(x, 4) for x in p3[::5]] + ([round(p3[-1], 4)] if (len(p3) - 1) % 5 else [])}
    return metrics, scen, price


def run(provider, etfs, out_dir, now, sources=None, second_price=None):
    out = pathlib.Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    prices, metrics, scen = (_load(out / f"{n}.json") for n in ("prices", "metrics", "scenarios"))
    if sources is None:
        sources = _load(ROOT / "config/sources.json")
    trust = _load(out / "trust.json")
    divs_out = _load(out / "dividends.json")
    hold_out = _load(out / "holdings.json")
    if "search_summary" in sources:   # two or more independent sources agree on the historic crash figures
        hs = trust_score(sources["search_summary"], True)
        trust["_history"] = {"source": sources["search_summary"]["name"], "score": hs["score"], "reasons": hs["reasons"]}
    for key, sid in (("_rask", "rask"), ("_github", "github_api")):
        if sid in sources:
            tr = trust_score(sources[sid], None)
            trust[key] = {"source": sources[sid].get("name", sid), "score": tr["score"], "reasons": tr["reasons"]}
    if "ato" in sources:
        # Tax rates were confirmed on two ATO pages that agree (rates page + tax-cut page) -> cross-checked.
        at = trust_score(sources["ato"], True)
        trust["_ato"] = {"source": sources["ato"].get("name", "ATO"), "score": at["score"], "reasons": at["reasons"]}
    failed, raw = [], {}
    for etf in etfs:
        t = etf["ticker"]
        try:
            dates, closes = provider.history(t)
            m, s, p = _entry(etf, dates, closes)
            metrics[t], scen[t], prices[t] = m, s, p
            raw[t] = (dates, closes)
            cc = crosscheck(t, closes[-1], second_price(t) if second_price else None)
            psrc = sources["yahoo"]
            pt = trust_score(psrc, cc["ok"])
            if cc["ok"] is False:
                pt["reasons"].append(f"Price differs from the ASX figure by {cc['gap']*100:.1f}%.")
            fc = etf.get("fee_check", "n/a")
            fsrc = {"issuer_page": "issuer", "issuer_page_via_search": "issuer_search"}.get(fc)
            facts = None
            if fsrc:
                ft = trust_score(sources[fsrc], None)
                facts = {"source": sources[fsrc].get("name", fsrc), "score": ft["score"],
                         "reasons": ft["reasons"], "url": etf.get("fee_url", "")}
            try:
                dv = summarize(provider.dividends(t), closes[-1], now)
                fr = etf.get("franking_check", "unknown")
                fsrc2 = {"issuer_page_via_search": "issuer_search"}.get(fr, "assumption")
                frs = trust_score(sources[fsrc2], None)
                dv["franking"] = {"value": etf.get("franking_pct"), "check": fr, "source": sources[fsrc2].get("name", fsrc2),
                                  "score": frs["score"], "reasons": frs["reasons"], "url": etf.get("franking_url", "")}
                dts = trust_score(sources["yahoo"], None)
                dv["trust"] = {"source": sources["yahoo"].get("name", "yahoo"), "score": dts["score"], "reasons": dts["reasons"]}
                divs_out[t] = dv
            except Exception:
                pass   # keep the previous dividend entry; prices are unaffected
            try:
                hv = provider.holdings(t)
                hs = summarize_holdings(*hv) if hv else None
                if hs:
                    ht = trust_score(sources["yahoo"], None)
                    hs["as_of"] = now.date().isoformat()
                    hs["trust"] = {"source": sources["yahoo"].get("name", "yahoo"), "score": ht["score"], "reasons": ht["reasons"]}
                    hold_out[t] = hs
            except Exception:
                pass   # keep the previous holdings entry; prices are unaffected
            trust[t] = {"price": {"source": psrc.get("name", "yahoo"), "score": pt["score"],
                                  "reasons": pt["reasons"], "crosscheck": cc["ok"], "gap": cc["gap"],
                                  "checked_against": "ASX website data service" if cc["ok"] is not None else None},
                        "facts": facts}
        except Exception:   # one bad ticker must never stop the whole daily run
            failed.append(t)
    if len(failed) < len(etfs):
        for n, v in (("prices", prices), ("metrics", metrics), ("scenarios", scen), ("trust", trust), ("dividends", divs_out), ("holdings", hold_out)):
            (out / f"{n}.json").write_text(json.dumps(v, separators=(",", ":")))
    meta = _load(out / "meta.json")
    meta_new = {"updated_utc": now.isoformat() if len(failed) < len(etfs) else meta.get("updated_utc"),
                "last_attempt_utc": now.isoformat(), "failed": sorted(failed)}
    (out / "meta.json").write_text(json.dumps(meta_new, indent=1))
    return raw


if __name__ == "__main__":
    import datetime as dt
    etfs = json.loads((ROOT / "config/etfs.json").read_text())
    now = dt.datetime.utcnow()
    run(YahooProvider(), etfs, ROOT / "data", now, second_price=asx_last_price)
    try:   # news must never break the price pipeline
        newsmod.refresh(ROOT / "data" / "news.json", json.loads((ROOT / "config/news_feeds.json").read_text()),
                        json.loads((ROOT / "config/sources.json").read_text()),
                        json.loads((ROOT / "config/news_rules.json").read_text()), etfs, now)
    except Exception as e:
        print("news refresh failed:", e)
