# CAMBRETH INTELLIGENCE — Critical Minerals Platform

Institutional-grade critical minerals intelligence on the Guardian-style frontend,
with a fully automatic, free, open-source backend.

## What this repo is

| Piece | File | What it does |
|---|---|---|
| Frontend | `index.html` | Your site (Guardian-style shell). Has two AI hooks: `#price-table` (Markets section) and `#articles` (first article grid) + two script tags. |
| AI engine | `ai-engine.js` | Loads a small open LLM (Phi-3-mini) in the browser via WebGPU/WebLLM, runs 10-iteration synthesis (researcher/chemist/economist/copywriter), returns prices JSON + original articles. |
| UI glue | `ui.js` | Auto-loads daily data, renders the price table, renders daily headlines, auto-runs the AI (no buttons), caches to IndexedDB, auto-refreshes every 30 min. |
| Daily data | `scripts/dig.py` | Fetches FRED live prices (7 metals) + PubChem chemistry + mining RSS headlines, merges with `data/seed-data.json` fallbacks, writes `data/raw-industrial.json`. Never breaks the site (always writes valid JSON). |
| Seed baseline | `data/seed-data.json` | Research-grounded fallback prices (lithium, cobalt, REEs, graphite, gallium…) with source + date per row. |
| Scheduler | `.github/workflows/daily-dig.yml` | Runs every day 07:00 UTC, fetches fresh data, commits it. Manual run also possible. |

## How it updates automatically (no buttons, no server)

1. **07:00 UTC daily** — GitHub Actions runs `dig.py` → writes fresh `data/raw-industrial.json` → commits it.
2. **Every page visit** — `ui.js` fetches the latest JSON (`cache: no-store`), renders prices + headlines instantly.
3. **Auto-synthesis** — in the background, the AI reads the daily JSON, runs 10 iterations, and replaces `#articles` with original content; result cached in IndexedDB for instant revisits.
4. **Every 30 minutes** — the page silently re-checks for new data and refreshes.

## Browser support for deep AI

- Full AI (client-side model): desktop **Chrome/Edge** (WebGPU). First run downloads the model once (~1–2 GB, cached).
- Everything else (iPhone/iPad, Firefox): the **daily prices + headlines still display** and cached AI content is shown; deep synthesis is skipped gracefully.

## Tested

- `dig.py` verified live: 16 prices (live FRED + seed fallback), 6 PubChem chemistry facts, real RSS headlines.
- `ai-engine.js` / `ui.js`: syntax-checked; full page loaded headlessly with zero breaking errors — price table renders, daily brief renders, AI failure degrades gracefully.
