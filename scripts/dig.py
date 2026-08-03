#!/usr/bin/env python3
"""
CAMBRETH INTELLIGENCE — Daily Dig (dig.py)  v2.0
=================================================
Fetches fresh public industrial data and writes data/raw-industrial.json.

Sources (all public, no API keys):
  1. FRED (St. Louis Fed) CSV  -> live metal prices (nickel, copper, aluminium, zinc,
     lead, tin, uranium). Lithium/cobalt attempted; graceful fallback to seed.
  2. PubChem REST              -> chemistry facts.
  3. Mining RSS (3 working)    -> daily headlines, auto-categorised.
  4. data/seed-data.json       -> researched baseline fallback.

Design:
  - CONCURRENT fetches (ThreadPoolExecutor) so a slow source never stalls the dig.
  - Tight timeouts + 1 retry per source.
  - ALWAYS writes valid JSON. Exit code 0 unless JSON itself is broken.
  - `--quick` skips live fetch (builds from seed) — instant + CI-safe.

Run:  python3 scripts/dig.py [--quick]
"""

import csv
import io
import itertools
import json
import re
import sys
import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SEED_PATH = ROOT / "data" / "seed-data.json"
OUT_PATH = ROOT / "data" / "raw-industrial.json"

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0 Safari/537.36")

FRED_SERIES = {
    "PNICKUSDM": "nickel", "PCOPPUSDM": "copper", "PALUMUSDM": "aluminium",
    "PZINCUSDM": "zinc", "PLEADUSDM": "lead", "PTINUSDM": "tin", "PURANUSDM": "uranium",
}
FRED_TRY_EXTRA = {"PPLTTTUSDM": "lithium_carbonate", "PCOBALTUSDM": "cobalt"}

RSS_FEEDS = [
    "https://www.mining-technology.com/feed/",
    "https://oilprice.com/rss/main",
    "https://www.nsenergybusiness.com/feed/",
]

COMPOUNDS = [
    "Lithium carbonate", "Cobalt sulfate heptahydrate", "Nickel(II) hydroxide",
    "Copper(II) oxide", "Graphite", "Uranium(VI) oxide",
]

CATEGORY_KEYWORDS = {
    "Policy": ["policy", "regulation", "export control", "tariff", "ira", "crm", "ndaa",
               "itar", "sanction", "government", "moFCOM", "quota", "act", "law"],
    "Markets": ["price", "market", "futures", "lme", "spot", "benchmark", "contract",
                "lithium", "cobalt", "nickel", "copper", "graphite", "uranium", "rare earth"],
    "Supply chain": ["mine", "mining", "supply", "refinery", "processing", "smelter",
                     "offtake", "project", "drilling", "production", "gigafactory"],
    "Demand": ["ev", "electric vehicle", "battery", "grid", "storage", "wind", "solar",
               "semiconductor", "defence", "defense", "data center", "ai"],
    "Intelligence": ["analysis", "report", "outlook", "forecast", "research", "strategy"],
}


CONTENT_PATH = ROOT / "data" / "content.json"

OG_RE = re.compile(r'<meta[^>]+(?:property|name)=["\']og:(?:image|title|site_name)["\'][^>]+content=["\']([^"\']*)["\']', re.I)
OG_RE2 = re.compile(r'<meta[^>]+content=["\']([^"\']*)["\'][^>]+(?:property|name)=["\']og:(?:image|title|site_name)["\']', re.I)


def extract_og(url):
    """Fetch a page and return {image, title, site_name} from OpenGraph meta."""
    data = http_get(url, timeout=15, retries=1)
    if not data:
        return {}
    text = data.decode("utf-8", "replace")
    out = {}
    for m in itertools.chain(OG_RE.finditer(text), OG_RE2.finditer(text)):
        prop = m.group(0)
        val = (m.group(1) if "content" in m.group(0)[:m.group(0).find("content")] else m.group(1))
        if "og:image" in prop and "image" not in out:
            out["image"] = val
        elif "og:title" in prop and "title" not in out:
            out["title"] = val
        elif "og:site_name" in prop and "site_name" not in out:
            out["site_name"] = val
    # fallback: first <img> src in description
    if "image" not in out:
        m = re.search(r'<img[^>]+src=["\']([^"\']+)["\']', text)
        if m and not m.group(1).startswith("data:"):
            out["image"] = m.group(1)
    if out.get("image") and out["image"].startswith("/"):
        from urllib.parse import urljoin
        out["image"] = urljoin(url, out["image"])
    return out


def enrich_articles(articles):
    """Fetch og:image + credit for articles that lack an image (parallel)."""
    def one(a):
        a = dict(a)
        url = a.get("source_url", "")
        if url and not a.get("image"):
            og = extract_og(url)
            if og.get("image"):
                a["image"] = og["image"]
                a["image_credit"] = og.get("site_name") or a.get("image_credit") or url.split("/")[2]
                print(f"  [ok] og:image {a.get('slug')} -> {og['image'][:60]}")
        return a
    with ThreadPoolExecutor(max_workers=6) as ex:
        return list(ex.map(one, articles))


def http_get(url, timeout=12, retries=1):
    last = None
    for _ in range(retries + 1):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except Exception as e:  # noqa: BLE001
            last = e
    print(f"  [warn] fetch failed: {url.split('?')[0][:80]} ({last})")
    return None


def parse_fred_csv(data):
    try:
        text = data.decode("utf-8", "replace")
        if "," not in text or text.lstrip().startswith("<"):
            return {}
        rows = list(csv.reader(io.StringIO(text)))
        out = {}
        for r in rows[1:]:
            if len(r) >= 2:
                try:
                    out[r[0]] = float(r[1])
                except ValueError:
                    continue
        return out
    except Exception:  # noqa: BLE001
        return {}


def latest_two(series):
    dates = sorted(series.keys())
    if not dates:
        return None, None, 0.0
    latest = series[dates[-1]]
    prev = series[dates[-2]] if len(dates) > 1 else latest
    chg = ((latest - prev) / prev * 100.0) if prev else 0.0
    return latest, dates[-1], chg


def fetch_one_fred(sid):
    url = f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={sid}"
    data = http_get(url)
    return sid, (parse_fred_csv(data) if data else {})


def fetch_fred_prices():
    out = {}
    all_ids = list(FRED_SERIES.items()) + list(FRED_TRY_EXTRA.items())
    with ThreadPoolExecutor(max_workers=6) as ex:
        futs = {ex.submit(fetch_one_fred, sid): key for sid, key in all_ids}
        for fut in as_completed(futs):
            key = futs[fut]
            try:
                sid, series = fut.result()
            except Exception:  # noqa: BLE001
                continue
            val, d, chg = latest_two(series)
            if val is not None:
                out[key] = {"price": round(val, 2), "date": d, "change_pct": round(chg, 2)}
                print(f"  [ok] FRED {key}: {val:.2f} ({d})")
            else:
                print(f"  [warn] FRED {key}: unavailable -> seed fallback")
    return out


def fetch_one_pubchem(name):
    url = ("https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/"
           + urllib.parse.quote(name) + "/property/MolecularFormula,MolecularWeight/JSON")
    data = http_get(url, timeout=12)
    if not data:
        return None
    try:
        j = json.loads(data)
        p = j["PropertyTable"]["Properties"][0]
        return {"compound": name, "formula": p.get("MolecularFormula", "n/a"),
                "mw": p.get("MolecularWeight"), "source": "PubChem"}
    except Exception:  # noqa: BLE001
        return None


def fetch_pubchem():
    out = []
    with ThreadPoolExecutor(max_workers=4) as ex:
        futs = [ex.submit(fetch_one_pubchem, c) for c in COMPOUNDS]
        for fut in as_completed(futs):
            r = fut.result()
            if r:
                out.append(r)
                print(f"  [ok] PubChem {r['compound']}: {r['formula']}")
    return out


def fetch_one_rss(feed):
    data = http_get(feed, timeout=15)
    if not data:
        return []
    items = []
    try:
        root = ET.fromstring(data)
    except Exception:  # noqa: BLE001
        return []
    for item in root.iter("item"):
        title = (item.findtext("title") or "").strip()
        link = (item.findtext("link") or "").strip()
        pub = (item.findtext("pubDate") or "").strip()
        if not title:
            continue
        img = ""
        mc = item.find("media:content", {"media": "http://search.yahoo.com/mrss/"})
        if mc is not None and mc.get("url"):
            img = mc.get("url")
        if not img:
            enc = item.find("enclosure")
            if enc is not None and enc.get("url"):
                img = enc.get("url")
        if not img:
            desc = (item.findtext("description") or "")
            m = re.search(r'<img[^>]+src=["\']([^"\']+)["\']', desc)
            if m and not m.group(1).startswith("data:"):
                img = m.group(1)
        items.append({"title": title[:180], "url": link,
                      "source": feed.split("//")[1].split("/")[0],
                      "date": pub[:16], "category": classify(title),
                      "summary": "", "image": img})
        if len(items) >= 8:
            break
    return items


def fetch_rss():
    out = []
    with ThreadPoolExecutor(max_workers=3) as ex:
        futs = [ex.submit(fetch_one_rss, f) for f in RSS_FEEDS]
        for fut in as_completed(futs):
            out.extend(fut.result() or [])
    return out[:24]


def classify(title):
    t = title.lower()
    best, score = "Markets", 0
    for cat, kws in CATEGORY_KEYWORDS.items():
        s = sum(1 for k in kws if k in t)
        if s > score:
            best, score = cat, s
    return best


def merge_prices(seed_prices, fred):
    merged = []
    for p in seed_prices:
        p = dict(p)
        if p["id"] in fred:
            f = fred[p["id"]]
            p["price"] = f["price"]
            p["assessment_date"] = f["date"]
            p["change_pct"] = f.get("change_pct", p.get("change_pct", 0.0))
            p["source"] = "FRED (live)"
            p["reliability"] = "live-fred"
        merged.append(p)
    return merged


def main():
    quick = "--quick" in sys.argv
    seed = json.loads(SEED_PATH.read_text(encoding="utf-8"))
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    print(f"[dig] start {now} {'(QUICK — seed only)' if quick else ''}")

    if quick:
        fred, chem, headlines = {}, seed.get("chemistry", []), seed.get("headlines", [])
    else:
        fred = fetch_fred_prices()
        chem = fetch_pubchem() or seed.get("chemistry", [])
        headlines = fetch_rss() or seed.get("headlines", [])

    # Cambreth editorial dataset: full articles + founder quotes
    content = {}
    if CONTENT_PATH.exists():
        content = json.loads(CONTENT_PATH.read_text(encoding="utf-8"))
    articles = enrich_articles(content.get("articles", []))
    founder = content.get("founder", {})

    prices = merge_prices(seed.get("prices", []), fred)

    out = {
        "meta": {
            "generated_at": now,
            "version": "2.0.0",
            "pipeline": "dig.py (concurrent FRED + PubChem + RSS + seed fallback)",
            "quick": quick,
            "note": "prices tagged live-fred are current; assessed-seed are researched baselines.",
        },
        "prices": prices,
        "headlines": headlines,
        "chemistry": chem,
        "articles": articles,
        "founder": founder,
    }

    # preserve previously generated AI articles + founder quote if dig runs standalone
    if OUT_PATH.exists():
        try:
            prev = json.loads(OUT_PATH.read_text(encoding="utf-8"))
            if prev.get("ai_articles") and not out.get("ai_articles"):
                out["ai_articles"] = prev["ai_articles"]
                out["ai_generated_at"] = prev.get("ai_generated_at", "")
            if prev.get("founder_today") and not out.get("founder_today"):
                out["founder_today"] = prev["founder_today"]
        except Exception:  # noqa: BLE001
            pass

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
    json.loads(OUT_PATH.read_text(encoding="utf-8"))  # validate
    live = sum(1 for p in prices if p.get("reliability") == "live-fred")
    print(f"[dig] wrote {OUT_PATH} — {len(prices)} prices ({live} live), "
          f"{len(headlines)} headlines, {len(chem)} chemistry")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:  # noqa: BLE001 — never let the site die
        print(f"[dig] FATAL, writing safe seed fallback: {exc}")
        try:
            seed = json.loads(SEED_PATH.read_text(encoding="utf-8"))
            seed["meta"] = dict(seed.get("meta", {}))
            seed["meta"]["generated_at"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
            seed["meta"]["note"] = "dig.py crashed — shipped seed snapshot so the site stays live."
            OUT_PATH.write_text(json.dumps(seed, indent=2, ensure_ascii=False), encoding="utf-8")
        except Exception:  # noqa: BLE001
            pass
        sys.exit(0)
