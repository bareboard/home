#!/usr/bin/env python3
"""
CAMBRETH INTELLIGENCE — Server-side Editorial Synthesis (synthesize.py)
========================================================================
Generates the day's ORIGINAL articles + Founder's quote on the server
(GitHub Actions), so EVERY device — phone, tablet, laptop — receives fresh
AI-grade journalism with zero WebGPU needed.

Design:
  - Deterministic editorial engine: writes dense, professional, data-grounded
    articles (chemistry + economics + rates) from the day's real numbers.
    Zero API keys, zero downloads, always works, never hallucinates.
  - Optional LLM boost: if the repo secret HF_TOKEN is set, each article is
    also drafted by a hosted open model (Hugging Face inference API) with the
    real data injected; any failure falls back to the deterministic engine.
  - Never crashes: always writes valid JSON (merges ai_articles + today_quote
    into data/raw-industrial.json).

Run:  python3 scripts/synthesize.py [--force]
"""

import json
import os
import random
import re
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_PATH = ROOT / "data" / "raw-industrial.json"

HF_TOKEN = os.environ.get("HF_TOKEN", "")
HF_MODEL = os.environ.get("HF_MODEL", "HuggingFaceH4/zephyr-7b-beta")
HF_URL = "https://api-inference.huggingface.co/models/" + HF_MODEL

UA = "Mozilla/5.0 (CambrethIntelligence/1.0)"


# --------------------------------------------------------------------------
# Editorial building blocks (original, non-cliché, institution-grade voice)
# --------------------------------------------------------------------------

OPENERS = [
    "The numbers in today's data file tell a story that the headlines only gesture at: {lead}.",
    "For institutions calibrating exposure, the relevant signal today is not the level of {lead} but the structure beneath it.",
    "Markets are rarely wrong about direction for long; they are frequently wrong about timing. Today's data on {lead} is a case in point.",
    "There is a difference between a price and a valuation. Today's assessment of {lead} belongs firmly in the first category.",
]

CHEM_ANGLE = {
    "lithium": "The conversion chain from spodumene concentrate to battery-grade carbonate and hydroxide remains the binding constraint: every tonne of Li2CO3 at 99.5% purity is a tonne that passed through a converter with the chemistry, the permits and the capital to do so.",
    "cobalt": "Cobalt sulphate, CoSO4·7H2O, is the intermediate that matters for cathode chemistry, and it concentrates where the refining chain concentrates — a fact the quota regime has made suddenly expensive.",
    "nickel": "Class I nickel — above 99.8% purity — is the only grade the cathode plants can use, and the HPAL route that produces it from laterites is a capital-intensive, commissioning-prone chain.",
    "copper": "Every energy-transition technology of consequence is a copper technology; grade decline at the world's porphyry operations means each incremental tonne costs more energy, water and time than the last.",
    "graphite": "The anode chain — spheronisation, purification, coating, graphitisation — is where graphite's strategic value is locked, and it remains overwhelmingly concentrated in Chinese processing.",
    "uranium": "Enrichment, not mining, is the downstream chokepoint; U3O8 must pass through conversion and enrichment before it becomes fuel, and that capacity is slower to add than any mine.",
    "rare earth": "Separation is the defining chemistry: thousands of solvent-extraction stages are required to move from mixed oxide to the individual magnet-grade elements, and the environmental footprint of that chemistry is the permit problem.",
}

ECON_ANGLE = (
    "On an assessed basis of {price} per {unit}, the {change}-day move of {pct}% embeds not just physical balance but the market's "
    "view of policy risk, inventory behavior and the financing cost of holding material. The assessment date, {date}, and its source "
    "should accompany any institutional citation of this number."
)

SUPPLY_ANGLE = {
    "lithium": "The supply response is reversible: marginal spodumene tonnage can return within two to three quarters, which is why contract structure matters more than price momentum.",
    "cobalt": "Availability, not just price, is now the traded variable; offtake secured at the refinery stage is worth more than spot optionality.",
    "nickel": "Mine location no longer determines supply-chain location; the refinery decides the economics and the security.",
    "copper": "Fifteen-year project lead times mean the tonnage that balances 2030 must be financed today; the deficit window is visible in the pipeline, not the price.",
    "graphite": "The midstream gap — mines that can be built in years versus processing that takes decades to scale — is the structural fact of the anode supply chain.",
    "uranium": "A decade of underinvestment means the supply curve cannot respond inside five years; long-term contracting is the rational instrument.",
    "rare earth": "The midstream gap is at its most extreme: solvent-extraction separation capacity outside China is the scarcest asset in the entire critical-minerals complex.",
}

WATCH_ANGLE = (
    "The watch items are therefore concrete: {watch}. Institutions that position against those markers — rather than against the "
    "headline number — are the ones whose risk is priced."
)

KEY_TAKEAWAYS = [
    "Key Takeaway: Price is the market's memory; the assessment date is its honesty. Anchor contracts to structure, not momentum.",
    "Key Takeaway: In this complex, security is a processing question wearing a mining costume. Finance the midstream.",
    "Key Takeaway: Treat single-source concentration as a duration risk: hedge it with offtake, not with forecasts.",
    "Key Takeaway: When a market is administered, a quoted price is a policy signal. When it is assessed, it is a scarcity signal. Know which you are reading.",
    "Key Takeaway: The projects that balance this market in 2030 are being financed today. Position accordingly.",
    "Key Takeaway: Volatility is information. The spread between assessment and administered prices is the market telling you where the leverage is.",
]

HEADLINE_TEMPLATES = [
    "{mineral}: the assessment tells a quieter story than the headline",
    "What today's {mineral} print actually says about the {theme}",
    "The {mineral} complex is repricing {theme} — and the data confirms it",
    "Reading {mineral} through the lens of {theme}",
    "{mineral} data, {pct}% {dir} in a day: structure over noise",
]

THEMES = ["supply discipline", "policy risk", "midstream economics", "structural demand", "inventory behaviour", "financing costs"]

# A curated bank of advanced, non-cliché Founder quotes (rotated daily;
# optionally overwritten by the LLM when HF_TOKEN is present).
FOUNDER_QUOTES = [
    "A mineral is only critical when the world discovers it cannot do without it. Our task is to be useful before that discovery becomes a crisis.",
    "Markets forgive miscalculation faster than they forgive complacency. The same is true of nations that outsource their own security to a single supplier.",
    "The transition to clean energy is not a technology problem. It is a supply-chain problem wearing a technology costume.",
    "Every tonne of ore tells the truth about an economy — its energy prices, its labour discipline, its regulatory honesty. We simply report what the ore already knows.",
    "Price is the market's memory of past mistakes and its guess about future ones. Both are worth studying; neither is worth worshipping.",
    "You cannot buy resilience at the last minute. You build it while the world is calm, and you pay for it either way — in investment now, or in leverage later.",
    "Concentration is not a supply-chain feature to be optimised; it is a vulnerability to be priced. The market is only now learning to do the arithmetic.",
    "The gap between a mine and a battery is not distance. It is chemistry, capital and permission — and permission is the slowest of the three.",
    "An assessment without a date is a rumour with a decimal point. We date everything, because dates are the only thing that discipline adds to information.",
    "The best hedge against a single-supplier world is not a second supplier. It is a second processing chain.",
    "Markets clear, but they do not forgive. Every deferred investment in processing capacity is a promissory note that comes due with interest.",
    "What looks like a price spike is often a supply chain announcing, politely, that it is already spoken for.",
]


def http_post(url, payload, token=None, timeout=40):
    try:
        data = json.dumps(payload).encode("utf-8")
        headers = {"Content-Type": "application/json", "User-Agent": UA}
        if token:
            headers["Authorization"] = "Bearer " + token
        req = urllib.request.Request(url, data=data, headers=headers)
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.read().decode("utf-8", "replace")
    except Exception as e:  # noqa: BLE001
        print(f"  [warn] HF inference unavailable: {e}")
        return None


def llm_article(mineral, data, cat):
    """Optional LLM draft; returns None on any failure."""
    prompt = (
        "You are the editorial desk of Cambreth Intelligence, an institutional critical-minerals "
        "newsroom. Write one original, professional, newspaper-grade article (about 450-600 words) "
        "about the mineral below. Use the real figures provided. Never invent numbers. Structure: "
        "a ### headline, a one-sentence summary, then paragraphs dense with chemistry (exact "
        "formulas, purity thresholds, extraction chemistry) and economics (the given price, its "
        "change, supply/demand, policy), then a **Key Takeaway** sentence. Voice: serious, "
        "analytical, not clichéd.\n\n"
        f"Mineral: {mineral}\nCategory: {cat}\n"
        f"Data: {json.dumps(data, ensure_ascii=False)}\n"
    )
    body = http_post(HF_URL, {"inputs": prompt}, token=HF_TOKEN)
    if not body:
        return None
    try:
        text = json.loads(body)[0]["generated_text"].replace(prompt, "").strip()
    except Exception:  # noqa: BLE001
        text = body[:2000]
    if not text or len(text) < 120:
        return None
    return text


def pick(prices, key):
    for p in prices:
        if p.get("id") == key or key in str(p.get("name", "")).lower():
            return p
    return None


def slugify(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")[:80]


def today_iso():
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def build_article(p, cat, theme, idx, overview=None):
    name = p.get("name", "the complex")
    unit = p.get("unit", "USD/t")
    price = p.get("price")
    low = p.get("low")
    high = p.get("high")
    form = p.get("form", "")
    pct = abs(float(p.get("change_pct", 0)))
    direction = "higher" if float(p.get("change_pct", 0)) >= 0 else "lower"
    date = p.get("assessment_date", today_iso())
    source = p.get("source", "assessed")
    chem = p.get("chemistry_key_fact") or CHEM_ANGLE.get(p.get("id", ""), "The chemistry of this material defines its strategic value.")
    chem_extra = CHEM_ANGLE.get(p.get("id", ""), "")
    supply = SUPPLY_ANGLE.get(p.get("id", ""), "The supply chain's binding constraint is processing, not geology.")

    headline_tpl = random.choice(HEADLINE_TEMPLATES)
    headline = headline_tpl.format(mineral=name.title(), theme=random.choice(THEMES), pct=pct, dir=direction)
    if headline.endswith("."):
        headline = headline[:-1]

    opener_tpl = random.choice(OPENERS)
    lead = f"{name.lower()} at {price} {unit}"
    opener = opener_tpl.format(lead=lead)

    watch = ", ".join(random.sample([
        "weekly assessment prints from the primary assessors", "inventory movements at registered warehouses",
        "policy statements from the dominant producer", "offtake announcements from the refining stage",
        "the spread between administered and assessed quotations", "financing decisions on midstream projects",
        "permit decisions on new processing capacity", "changes in the administered reference price in the dominant market",
    ], 4))

    # range context when available
    range_txt = ""
    if low and high:
        range_txt = (f"The assessment range of {low} to {high} {unit} frames the day's print: the low end represents "
                     f"committed tonnage from integrated producers, while the high end is the marginal cost of the "
                     f"last buyer in the market. The location of the print within that band is itself a signal of "
                     f"where the market believes the cycle sits.\n\n")

    form_txt = f"The traded form — {form} — carries its own premium ladder, and institutions comparing prices across "
    if form:
        form_txt = (f"The traded form — {form} — carries its own premium ladder: purity thresholds separate battery grade from "
                    f"technical grade, and the spread between them widens when downstream chemistry becomes the binding constraint. "
                    f"Institutions comparing prices across forms are, in effect, comparing different products.\n\n")
    else:
        form_txt = ""

    paragraph = (
        f"{opener}\n\n"
        f"{chem}\n\n"
        f"{chem_extra}\n\n"
        f"On an assessed basis of {price} {unit}, the move of {pct}% on the day embeds not just physical balance but the "
        f"market's view of policy risk, inventory behaviour and the financing cost of holding material. The assessment "
        f"date, {date}, and its source, {source}, should accompany any institutional citation of this number. "
        f"{range_txt}"
        f"{form_txt}"
        f"{supply}\n\n"
        f"The policy dimension compounds the commercial one. Export licensing, administered pricing and procurement rules "
        f"all act on this market simultaneously, and each carries a different effective date. The result is a market in "
        f"which the price is the last thing to move and the first thing to be quoted.\n\n"
        f"{WATCH_ANGLE.format(watch=watch)}\n\n"
        f"For the value chain, the operational translation is direct: buyers who anchor contracts to the structure "
        f"described above — indexed to a dated assessment with a defined form and purity — convert a volatile commodity "
        f"into a manageable procurement line. Those who trade headline levels are, in effect, writing optionality on "
        f"policy they do not control.\n\n"
        f"{random.choice(KEY_TAKEAWAYS)}"
    )

    return {
        "slug": slugify(f"{p.get('id', 'market')}-{today_iso()}"),
        "category": cat,
        "kicker": name.title(),
        "headline": headline,
        "summary": f"{name.title()} assessed at {price} {unit}, {pct}% {direction} on the day; the structure beneath the print matters more than the move itself.",
        "byline": "Cambreth Intelligence",
        "date": today_iso(),
        "source_url": "",
        "image_credit": "",
        "body": paragraph,
        "origin": "server-synthesis",
        "related_categories": [],
    }


def build_overview(data):
    """A single daily market-overview briefing synthesizing the whole table."""
    prices = data.get("prices", [])
    if not prices:
        return None
    dated = [p for p in prices if p.get("assessment_date")]
    latest = max((p.get("assessment_date", "") for p in prices), default="")
    names = ", ".join(p.get("name", "mineral") for p in prices[:5])
    movers = sorted([p for p in prices if p.get("price")],
                    key=lambda p: abs(float(p.get("change_pct", 0))), reverse=True)[:3]
    mover_txt = "; ".join(f"{m.get('name')} {abs(float(m.get('change_pct',0))):.1f}% {'higher' if float(m.get('change_pct',0))>=0 else 'lower'}"
                          for m in movers) if movers else "broadly steady"
    body = (
        f"Today's assessment file covers {names}, and the composite picture is more instructive than any single print. "
        f"The day's notable moves: {mover_txt}. Across the complex, the pattern is consistent: markets are repricing "
        f"policy risk faster than they are repricing physical balance.\n\n"
        f"The discipline that matters for institutional readers is source integrity. Each figure in the table carries an "
        f"assessment date ({latest}) and a named source, and the reliability tag distinguishes live exchange/FRED prints "
        f"from assessed baselines that await a live feed. Where no verifiable price exists, the correct notation is GAP — "
        f"an absence stated plainly, rather than an estimate dressed as data.\n\n"
        f"The trading implication is structural rather than directional. With processing capacity remaining the binding "
        f"constraint across lithium, rare earths, graphite and nickel, and with policy calendars running to specific "
        f"dates, the durable edge belongs to contracts anchored to dated, sourced assessments — not to price forecasts.\n\n"
        f"{random.choice(KEY_TAKEAWAYS)}"
    )
    return {
        "slug": slugify(f"daily-market-overview-{today_iso()}"),
        "category": "Markets",
        "kicker": "Briefing",
        "headline": "Daily market overview: the composite tells a sharper story than any single print",
        "summary": "Across the assessed complex, markets are repricing policy risk faster than physical balance; dated, sourced assessments remain the only durable anchor.",
        "byline": "Cambreth Intelligence",
        "date": today_iso(),
        "source_url": "",
        "image_credit": "",
        "body": body,
        "origin": "server-synthesis",
        "related_categories": [],
    }


def generate_deterministic(data):
    prices = data.get("prices", [])
    articles = []
    ov = build_overview(data)
    if ov:
        articles.append(ov)
    # top movers -> a Market Pulse article each
    movers = sorted([p for p in prices if p.get("price")], key=lambda p: abs(float(p.get("change_pct", 0))), reverse=True)
    used = set()
    for p in movers[:3]:
        articles.append(build_article(p, "Markets", "market dynamics", len(articles)))
        used.add(p.get("id"))
    # one per core category using a representative mineral
    cat_mineral = {
        "Policy": "rare earth",
        "Supply chain": "graphite",
        "Demand": "copper",
        "Intelligence": "lithium",
    }
    for cat, key in cat_mineral.items():
        p = pick(prices, key)
        if p and p.get("id") not in used:
            articles.append(build_article(p, cat, "structural themes", len(articles)))
            used.add(p.get("id"))
    return articles


def llm_articles(data, cats):
    """Try the LLM for each category; fall back per-article to deterministic."""
    out = []
    prices = data.get("prices", [])
    for cat in cats:
        p = pick(prices, cat.lower()) or (prices[0] if prices else None)
        if not p:
            continue
        text = llm_article(p.get("name", cat), p, cat)
        if text:
            out.append({
                "slug": slugify(f"{p.get('id', cat)}-{today_iso()}-llm"),
                "category": cat,
                "kicker": p.get("name", cat).title(),
                "headline": (text.split("\n")[0].replace("###", "").strip())[:110] or f"{cat} — today's read",
                "summary": (text.split("\n")[1] if len(text.split("\n")) > 1 else "")[:200],
                "byline": "Cambreth Intelligence",
                "date": today_iso(),
                "source_url": "",
                "image_credit": "",
                "body": text,
                "origin": "server-llm",
                "related_categories": [],
            })
        else:
            out.append(build_article(p, cat, "structural themes", len(out)))
    return out


def founder_today(data):
    f = data.get("founder", {})
    quotes = f.get("quotes") or FOUNDER_QUOTES
    day = datetime.now(timezone.utc).timetuple().tm_yday
    idx = (day - 1) % len(quotes)
    return {
        "name": f.get("name", "Fahadh Haneef Cambreth"),
        "role": f.get("role", "Founder, The Cambreth Organization"),
        "photo": f.get("photo", ""),
        "quote": quotes[idx],
        "quote_index": idx,
        "date": today_iso(),
        "signoff": f.get("signoff", "— Fahadh Haneef Cambreth"),
    }


def main():
    force = "--force" in sys.argv
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    cats = ["Markets", "Policy", "Supply chain", "Demand", "Intelligence"]

    print("[synth] start")
    ai_articles = None
    if HF_TOKEN:
        print("[synth] HF_TOKEN present — trying hosted LLM drafts")
        ai_articles = llm_articles(data, cats)
    if not ai_articles:
        print("[synth] using deterministic editorial engine")
        ai_articles = generate_deterministic(data)

    data["ai_articles"] = ai_articles
    data["ai_generated_at"] = today_iso()
    data["founder_today"] = founder_today(data)

    DATA_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    json.loads(DATA_PATH.read_text(encoding="utf-8"))  # validate
    origins = {}
    for a in ai_articles:
        origins[a.get("origin", "det")] = origins.get(a.get("origin", "det"), 0) + 1
    print(f"[synth] wrote {len(ai_articles)} AI articles ({origins}) + founder quote to {DATA_PATH}")
    print("[synth] done")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:  # noqa: BLE001 — never break the site
        print(f"[synth] FATAL: {exc}")
        try:
            data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
            data.setdefault("ai_articles", [])
            data["ai_generated_at"] = today_iso()
            data["founder_today"] = founder_today(data)
            DATA_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
            print("[synth] wrote safe fallback")
        except Exception:  # noqa: BLE001
            pass
        sys.exit(0)
