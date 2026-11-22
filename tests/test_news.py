import datetime as dt
from etf.news import parse_feed, tag_item, build_news, same_story

NOW = dt.datetime(2026, 11, 22, 12, 0)
RSS = b"""<?xml version="1.0"?><rss version="2.0"><channel>
<item><title>ASX falls as Wall Street tumbles</title><link>https://ex.com/a</link><pubDate>Sun, 22 Nov 2026 06:12:55 +0000</pubDate></item>
<item><title>No date here</title><link>https://ex.com/b</link></item></channel></rss>"""
ATOM = b"""<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><entry><title>RBA holds cash rate</title>
<link href="https://rba.gov.au/x"/><updated>2026-11-21T01:00:00Z</updated></entry></feed>"""
RDF = b"""<?xml version="1.0"?><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/" xmlns:dc="http://purl.org/dc/elements/1.1/">
<item><title>Media release: rates</title><link>https://rba.gov.au/y</link><dc:date>2026-11-20T03:00:00+11:00</dc:date></item></rdf:RDF>"""

RULES = {"topics": {
  "selloff": {"label": "Market falls", "categories": ["core"], "keywords": ["tumbles", "plunge"]},
  "tech_ai": {"label": "Tech & AI", "tickers": ["NDQ"], "keywords": ["Nvidia"], "case_sensitive": ["AI"]},
  "au_market": {"label": "Australian market", "tickers": ["A200"], "keywords": ["ASX"]}},
  "negative": ["falls", "tumbles", "plunge"], "positive": ["rally", "gains"]}
ETFS = [{"ticker": "A200", "category": "core"}, {"ticker": "NDQ", "category": "tech"}, {"ticker": "CSL", "category": "reference"}]

def test_parse_rss_atom_rdf():
    r = parse_feed(RSS)
    assert r[0]["title"] == "ASX falls as Wall Street tumbles" and r[0]["link"] == "https://ex.com/a"
    assert r[0]["published"] == "2026-11-22T06:12:55+00:00" and r[1]["published"] is None
    a = parse_feed(ATOM)[0]
    assert a["link"] == "https://rba.gov.au/x" and a["published"] == "2026-11-21T01:00:00+00:00"
    d = parse_feed(RDF)[0]
    assert d["published"] == "2026-11-19T16:00:00+00:00"          # converted to UTC

def test_parse_garbage_and_xxe_safe():
    assert parse_feed(b"not xml at all") == []
    bomb = b'<?xml version="1.0"?><!DOCTYPE x [<!ENTITY a "aaaa"><!ENTITY b "&a;&a;&a;&a;">]><rss><channel><item><title>&b;</title></item></channel></rss>'
    assert parse_feed(bomb) == []                                  # entity declarations refused

def test_tag_item_topics_tickers_tone():
    t = tag_item("ASX falls as Wall Street tumbles", RULES, ETFS)
    assert set(t["topics"]) == {"selloff", "au_market"}
    assert t["tickers"] == ["A200"] and t["tone"] == "negative"    # 'core' category -> A200 only (CSL is reference)

def test_tag_item_case_sensitive_and_no_false_positives():
    assert tag_item("Parliament said it would pay", RULES, ETFS)["topics"] == []        # 'AI' must not match inside 'said'
    assert "tech_ai" in tag_item("AI spending slows", RULES, ETFS)["topics"]
    assert tag_item("Wallabies win again", RULES, ETFS)["topics"] == []
    assert tag_item("", RULES, ETFS)["topics"] == []

def test_same_story():
    assert same_story("Wall Street tumbles as tech stocks plunge", "Tech stocks plunge as Wall Street tumbles")
    assert not same_story("RBA holds rates steady", "Wallabies beat Wales")

SOURCES = {"abc": {"type": "news", "name": "ABC", "scores": {"primary": 12, "independent": 17, "transparent": 17, "timely": 14}, "reasons": {}},
           "cnbc": {"type": "news", "name": "CNBC", "scores": {"primary": 12, "independent": 12, "transparent": 15, "timely": 14}, "reasons": {}}}

def _raw(**kw):
    return {"abc": [{"title": "ASX falls as Wall Street tumbles", "link": "https://abc/1", "published": "2026-11-22T06:00:00+00:00"},
                    {"title": "Wallabies win", "link": "https://abc/2", "published": "2026-11-22T05:00:00+00:00"},
                    {"title": "ASX old news tumbles", "link": "https://abc/3", "published": "2026-10-01T05:00:00+00:00"}],
            "cnbc": [{"title": "Wall Street tumbles, ASX falls", "link": "https://cnbc/1", "published": "2026-11-22T07:00:00+00:00"}], **kw}

def test_build_filters_dedupes_and_crosschecks():
    n = build_news(_raw(), SOURCES, RULES, ETFS, NOW)
    titles = [i["title"] for i in n["items"]]
    assert len(n["items"]) == 1                                    # sport dropped, >7 days dropped, duplicate merged
    it = n["items"][0]
    assert it["reported_by"] == 2 and it["trust"]["score"] > 12 + 17 + 17 + 14 - 1   # cross-check bonus applied (+15)
    assert it["link"].startswith("https://") and it["tone"] == "negative"
    assert n["by_topic"]["selloff"] == 1 and n["failed"] == []
    assert n["topic_labels"]["selloff"] == "Market falls"

def test_build_single_source_not_crosschecked_and_opinion_cap():
    raw = {"abc": [{"title": "ASX tumbles on rate fears", "link": "https://abc/opinion/9", "published": "2026-11-22T06:00:00+00:00"}]}
    it = build_news(raw, SOURCES, RULES, ETFS, NOW)["items"][0]
    assert it["reported_by"] == 1 and it["trust"]["score"] <= 60 and any("pinion" in r for r in it["trust"]["reasons"])

def test_build_failed_feed_reported_and_bad_links_dropped():
    raw = _raw(guardian=None)
    n = build_news(raw, SOURCES, RULES, ETFS, NOW)
    assert n["failed"] == ["guardian"]
    bad = {"abc": [{"title": "ASX tumbles", "link": "javascript:alert(1)", "published": "2026-11-22T06:00:00+00:00"}]}
    assert build_news(bad, SOURCES, RULES, ETFS, NOW)["items"] == []


def test_refresh_tolerates_failing_feed_and_keeps_old_file_when_all_fail(tmp_path):
    from etf.news import refresh
    import json
    out = tmp_path / "news.json"
    feeds = [{"id": "abc", "url": "u1"}, {"id": "cnbc", "url": "u2"}]
    rss = b"<rss><channel><item><title>ASX tumbles on rate fears</title><link>https://x.com/1</link><pubDate>Sun, 22 Nov 2026 06:00:00 +0000</pubDate></item></channel></rss>"
    def get(u):
        if u == "u2":
            raise OSError("blocked")
        return rss
    n = refresh(out, feeds, SOURCES, RULES, ETFS, NOW, get=get)
    assert n["failed"] == ["cnbc"] and len(n["items"]) == 1
    before = out.read_text()
    def dead(u): raise OSError("offline")
    assert refresh(out, feeds, SOURCES, RULES, ETFS, NOW, get=dead) is None
    assert out.read_text() == before


def test_per_source_cap_and_publisher_split():
    many = [{"title": f"ASX tumbles alpha{i} bravo{i} charlie{i}", "link": f"https://g/{i}", "published": "2026-11-22T06:00:00+00:00"} for i in range(30)]
    g = {"google_asx": {"type": "aggregator", "name": "Google News: ASX", "scores": {"primary": 8, "independent": 10, "transparent": 8, "timely": 14}, "reasons": {}}}
    n = build_news({"google_asx": many}, g, RULES, ETFS, NOW, per_source=12)
    assert len(n["items"]) == 12
    raw = {"google_asx": [{"title": "ASX tumbles as Wall Street slides - Australian Financial Review", "link": "https://g/z", "published": "2026-11-22T06:00:00+00:00"}]}
    it = build_news(raw, g, RULES, ETFS, NOW)["items"][0]
    assert it["title"] == "ASX tumbles as Wall Street slides" and it["publisher"] == "Australian Financial Review"
    plain = {"abc": [{"title": "ASX tumbles - a long-running story", "link": "https://abc/q", "published": "2026-11-22T06:00:00+00:00"}]}
    assert build_news(plain, SOURCES, RULES, ETFS, NOW)["items"][0]["publisher"] is None    # only aggregators are split


def test_market_context_gate():
    rules = {**RULES, "context": ["stocks", "shares", "market", "ASX", "RBA"]}
    tg = tag_item("AI reshapes travel planning", rules, ETFS)
    assert "tech_ai" in tg["topics"] and tg["context"] is False         # keyword hit but not about markets
    assert tag_item("AI stocks tumble", rules, ETFS)["context"] is True
    assert tag_item("AI reshapes travel planning", RULES, ETFS)["context"] is True   # no context list = no gate
    raw = {"abc": [{"title": "AI reshapes travel planning", "link": "https://a/1", "published": "2026-11-22T06:00:00+00:00"},
                   {"title": "AI stocks tumble", "link": "https://a/2", "published": "2026-11-22T06:00:00+00:00"}]}
    items = build_news(raw, SOURCES, rules, ETFS, NOW)["items"]
    assert [i["title"] for i in items] == ["AI stocks tumble"]
