"""News feed: parse public RSS/Atom feeds, keep only items relevant to the watched funds,
tag them, merge duplicates across outlets (which doubles as a cross-check) and score trust.
Titles and links only: no article text is copied. Tone is a keyword guess, not analysis."""
from __future__ import annotations
import json, re, urllib.request
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from urllib.parse import urlparse
from defusedxml import ElementTree as ET   # refuses entity tricks / external entities
from etf.trust import trust_score

STOP = set("the and for with from that this will after over into amid says say new more than have has its are was were but not out how why what who".split())
MAX_BYTES = 2_000_000


def _local(tag):
    return tag.split("}")[-1]


def _parse_date(s):
    if not s:
        return None
    s = s.strip()
    try:
        dt = parsedate_to_datetime(s)
    except Exception:
        try:
            dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        except Exception:
            return None
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat()


def parse_feed(data):
    try:
        root = ET.fromstring(data)
    except Exception:
        return []
    out = []
    for el in root.iter():
        if _local(el.tag) not in ("item", "entry"):
            continue
        f = {}
        for c in el:
            n = _local(c.tag)
            if n == "title" and "title" not in f:
                f["title"] = (c.text or "").strip()
            elif n == "link" and "link" not in f:
                f["link"] = (c.attrib.get("href") or c.text or "").strip()
            elif n in ("pubDate", "published", "updated", "date") and "published" not in f:
                f["published"] = _parse_date(c.text)
        if f.get("title") and f.get("link"):
            out.append({"title": f["title"], "link": f["link"], "published": f.get("published")})
        if len(out) >= 60:
            break
    return out


def _matcher(words, case_sensitive=False):
    if not words:
        return None
    pat = "|".join(re.escape(w) for w in sorted(words, key=len, reverse=True))
    return re.compile(r"(?<![\w])(?:%s)(?![\w])" % pat, 0 if case_sensitive else re.I)


def tag_item(title, rules, etfs):
    topics, tickers = [], set()
    for name, t in rules["topics"].items():
        hit = False
        for m in (_matcher(t.get("keywords", [])), _matcher(t.get("case_sensitive", []), True)):
            if m and m.search(title or ""):
                hit = True
        if not hit:
            continue
        topics.append(name)
        tickers.update(t.get("tickers", []))
        cats = set(t.get("categories", []))
        tickers.update(e["ticker"] for e in etfs if e["category"] in cats and e["category"] != "reference")
    neg = len(_matcher(rules.get("negative", [])).findall(title or "")) if rules.get("negative") else 0
    pos = len(_matcher(rules.get("positive", [])).findall(title or "")) if rules.get("positive") else 0
    tone = "negative" if neg > pos else "positive" if pos > neg else "neutral"
    cm = _matcher(rules.get("context", []))
    return {"topics": topics, "tickers": sorted(tickers), "tone": tone, "context": bool(cm.search(title or "")) if cm else True}


def _tokens(s):
    return {w for w in re.findall(r"[a-z0-9&]+", (s or "").lower()) if len(w) >= 3 and w not in STOP}


def same_story(a, b, threshold=0.5):
    ta, tb = _tokens(a), _tokens(b)
    if not ta or not tb:
        return False
    return len(ta & tb) / len(ta | tb) >= threshold


def _safe_link(u):
    try:
        return urlparse(u).scheme in ("http", "https")
    except Exception:
        return False


def _is_opinion(link):
    return any(p in (link or "").lower() for p in ("/opinion/", "/commentisfree/", "/comment/"))


def build_news(raw, sources, rules, etfs, now, max_age_days=7, cap=80, per_source=12):
    failed = sorted(k for k, v in raw.items() if v is None)
    cands = []
    for sid, items in raw.items():
        for it in items or []:
            if not _safe_link(it.get("link")) or not it.get("published"):
                continue
            pub = datetime.fromisoformat(it["published"])
            if pub.tzinfo is None:
                pub = pub.replace(tzinfo=timezone.utc)
            n = now if now.tzinfo else now.replace(tzinfo=timezone.utc)
            if pub < n - timedelta(days=max_age_days) or pub > n + timedelta(days=1):
                continue
            tag = tag_item(it["title"], rules, etfs)
            if not tag["topics"] or not tag["context"]:
                continue
            cands.append({**it, **tag, "source_id": sid, "pub": pub})
    cands.sort(key=lambda c: c["pub"], reverse=True)
    seen_n, capped = {}, []
    for c in cands:          # no single outlet or search can crowd out the rest
        seen_n[c["source_id"]] = seen_n.get(c["source_id"], 0) + 1
        if seen_n[c["source_id"]] <= per_source:
            capped.append(c)
    cands = capped
    clusters = []
    for c in cands:
        for cl in clusters:
            if same_story(cl["title"], c["title"]):
                cl["sources"].add(c["source_id"])
                break
        else:
            c["sources"] = {c["source_id"]}
            clusters.append(c)
    default = {"type": "aggregator", "name": "Unrated source", "scores": {"primary": 5, "independent": 5, "transparent": 5, "timely": 5}, "reasons": {}}
    items, by_topic = [], {}
    for c in clusters[:cap]:
        src = dict(sources.get(c["source_id"], default))
        if _is_opinion(c["link"]):
            src["type"] = "opinion"
        reported = len(c["sources"])
        ts = trust_score(src, True if reported >= 2 else None)
        if reported >= 2:
            others = sorted(sources.get(s, default).get("name", s) for s in c["sources"] if s != c["source_id"])
            ts["reasons"] = [r for r in ts["reasons"] if "cross-checked" not in r]
            also = others
        else:
            also = []
        title, publisher = c["title"], None
        if src.get("type") == "aggregator" and " - " in title:     # Google News appends the outlet name
            title, publisher = title.rsplit(" - ", 1)
            title, publisher = title.strip(), publisher.strip()
        items.append({"title": title, "publisher": publisher, "link": c["link"], "source": src.get("name", c["source_id"]),
                      "source_id": c["source_id"], "published": c["published"], "topics": c["topics"],
                      "tickers": c["tickers"], "tone": c["tone"], "reported_by": reported, "also": also,
                      "trust": {"score": ts["score"], "reasons": ts["reasons"], "source": src.get("name", c["source_id"])}})
        for t in c["topics"]:
            by_topic[t] = by_topic.get(t, 0) + 1
    return {"updated_utc": now.isoformat(), "items": items, "by_topic": by_topic, "topic_labels": {k: v["label"] for k, v in rules["topics"].items()}, "failed": failed}


def http_get(url, timeout=20):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (etf-dashboard news reader)"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read(MAX_BYTES)


def refresh(out_path, feeds, sources, rules, etfs, now, get=http_get):
    """Fetch every feed; one failing feed never stops the rest. If all fail, keep the previous file."""
    raw = {}
    for f in feeds:
        try:
            raw[f["id"]] = parse_feed(get(f["url"]))
        except Exception:
            raw[f["id"]] = None
    if all(v is None for v in raw.values()):
        return None
    news = build_news(raw, sources, rules, etfs, now)
    with open(out_path, "w") as fh:
        json.dump(news, fh, separators=(",", ":"))
    return news
