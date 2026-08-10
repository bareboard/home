#!/usr/bin/env python3
"""UMS LIVE daily article sourcing pipeline.

Fetches declared public feeds, filters them for the publication's coverage areas,
deduplicates items, captures source credit and original URL, and writes a static
JSON feed consumed by the homepage. No headlines or summaries are invented.
"""
from __future__ import annotations

import datetime as dt
import html
import json
import re
import sys
import time
import urllib.request
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / "data" / "source-feeds.json"
OUTPUT = ROOT / "data" / "daily-articles.json"
USER_AGENT = "UMSLIVEResearchBot/1.0 (+https://ums.github.io)"
KEYWORDS = {
    "critical minerals", "lithium", "cobalt", "nickel", "copper", "graphite",
    "rare earth", "neodymium", "praseodymium", "manganese", "gallium",
    "germanium", "tungsten", "antimony", "tin", "zinc", "aluminum",
    "battery materials", "anode", "cathode", "permanent magnet", "mineral processing",
    "aggregate", "aggregates", "quarry", "crushed stone", "construction sand",
    "construction gravel", "construction materials", "infrastructure"
}
TOPIC_MAP = {
    "lithium": ["lithium", "spodumene", "carbonate", "brine", "lce"],
    "cobalt": ["cobalt", "congo", "drc"],
    "nickel": ["nickel", "nmc"],
    "copper": ["copper", "smelter", "concentrate"],
    "graphite": ["graphite", "anode"],
    "rare-earths": ["rare earth", "neodymium", "praseodymium", "dysprosium", "terbium", "magnet"],
    "aggregates": ["aggregate", "quarry", "crushed stone", "sand", "gravel"],
}

def text(node: ET.Element | None) -> str:
    if node is None:
        return ""
    return " ".join("".join(node.itertext()).split())

def clean(value: str) -> str:
    value = html.unescape(value or "")
    value = re.sub(r"<[^>]+>", " ", value)
    return " ".join(value.split())

def request(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/rss+xml, application/xml, text/xml, text/html"})
    with urllib.request.urlopen(req, timeout=20) as response:
        return response.read()

def date_value(raw: str) -> str:
    if not raw:
        return dt.datetime.now(dt.timezone.utc).isoformat()
    try:
        return parsedate_to_datetime(raw).astimezone(dt.timezone.utc).isoformat()
    except Exception:
        return dt.datetime.now(dt.timezone.utc).isoformat()

def topic_for(blob: str) -> str:
    low = blob.lower()
    for topic, terms in TOPIC_MAP.items():
        if any(term in low for term in terms):
            return topic
    return "critical-minerals"

def image_from_item(item: ET.Element) -> str:
    # RSS media namespace is inconsistent; inspect all attributes for image URLs.
    for child in item.iter():
        for value in child.attrib.values():
            if isinstance(value, str) and re.search(r"\.(?:jpg|jpeg|png|webp)(?:\?|$)", value, re.I):
                return value
    return ""

def parse_feed(raw: bytes, source: dict) -> list[dict]:
    root = ET.fromstring(raw)
    entries = []
    for item in root.findall(".//item") + root.findall(".//{http://www.w3.org/2005/Atom}entry"):
        title = clean(text(item.find("title")) or text(item.find("{http://www.w3.org/2005/Atom}title")))
        link = clean(text(item.find("link")))
        atom_link = item.find("{http://www.w3.org/2005/Atom}link")
        if atom_link is not None and atom_link.get("href"):
            link = atom_link.get("href")
        summary = clean(text(item.find("description")) or text(item.find("{http://www.w3.org/2005/Atom}summary")) or text(item.find("{http://www.w3.org/2005/Atom}content")))
        published = clean(text(item.find("pubDate")) or text(item.find("{http://www.w3.org/2005/Atom}published")) or text(item.find("{http://www.w3.org/2005/Atom}updated")))
        blob = f"{title} {summary}".lower()
        title_blob = title.lower()
        # A feed's generic category copy often says “mining” or “critical”; require the headline itself to be relevant.
        if not title or not link or not any(re.search(r"(?<![a-z])" + re.escape(keyword) + r"(?![a-z])", title_blob) for keyword in KEYWORDS):
            continue
        entries.append({
            "title": title[:180],
            "summary": summary[:300] or "Read the original reporting for the full analysis.",
            "source": source["name"],
            "url": link,
            "image": image_from_item(item),
            "published": date_value(published),
            "topic": topic_for(blob),
            "authority": source["authority"],
        })
    return entries

def enrich_article(entry: dict) -> dict:
    """Resolve a direct source URL and capture an original publisher image where publicly exposed."""
    try:
        req = urllib.request.Request(entry["url"], headers={"User-Agent": USER_AGENT, "Accept": "text/html"})
        with urllib.request.urlopen(req, timeout=12) as response:
            entry["url"] = response.geturl()
            if not entry.get("image"):
                page = response.read(350000).decode("utf-8", "ignore")
                match = re.search(r'<meta[^>]+(?:property|name)=["\'](?:og:image|twitter:image)["\'][^>]+content=["\']([^"\']+)', page, re.I)
                if not match:
                    match = re.search(r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+(?:property|name)=["\'](?:og:image|twitter:image)', page, re.I)
                if match:
                    entry["image"] = html.unescape(match.group(1))
    except Exception:
        pass
    return entry

def score(entry: dict) -> float:
    now = dt.datetime.now(dt.timezone.utc)
    try:
        age_hours = max(0, (now - dt.datetime.fromisoformat(entry["published"])).total_seconds() / 3600)
    except Exception:
        age_hours = 168
    freshness = max(0, 72 - min(age_hours, 72)) / 12
    title = entry["title"].lower()
    signal = sum(term in title for term in ["export", "ban", "quota", "mine", "refinery", "supply", "price", "processing", "project", "aggregate"])
    return entry["authority"] * 10 + freshness + signal

def main() -> int:
    config = json.loads(CONFIG.read_text())
    all_entries, failures = [], []
    for source in config["sources"]:
        try:
            all_entries.extend(parse_feed(request(source["url"]), source))
        except Exception as exc:
            failures.append({"source": source["name"], "error": str(exc)[:160]})
    unique = {}
    for entry in all_entries:
        key = re.sub(r"[^a-z0-9]", "", entry["title"].lower())[:100]
        if key and (key not in unique or score(entry) > score(unique[key])):
            unique[key] = entry
    ranked = sorted(unique.values(), key=score, reverse=True)[:30]
    ranked = [enrich_article(entry) for entry in ranked]
    # Reserve the highest-ranked signal for the non-linking LIVE display.
    # It is intentionally removed from the sourced-card feed to prevent duplication.
    live_article = ranked[0] if ranked else None
    article_feed = ranked[1:] if len(ranked) > 1 else []
    output = {
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        "method": "public-source feed collection, keyword relevance, deduplication and transparent ranking",
        "live_article": live_article,
        "articles": article_feed,
        "source_failures": failures,
    }
    OUTPUT.write_text(json.dumps(output, indent=2, ensure_ascii=False))
    print(f"Wrote {len(ranked)} articles from {len(config['sources']) - len(failures)} reachable sources")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
