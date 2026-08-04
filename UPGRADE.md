# UPGRADE GUIDE — Cambreth Intelligence v2 (server-side AI articles)

This update makes the **daily AI-written articles work on EVERY device (phones included)** —
because they're now generated on GitHub's server each morning, not in the visitor's browser.

## What changed in this version

| File | Change |
|---|---|
| `scripts/synthesize.py` | **NEW.** Runs in GitHub Actions every morning, reads the fresh data, writes the day's 7 original AI articles + the Founder's daily quote into `raw-industrial.json`. Works with no API keys (deterministic engine). |
| `.github/workflows/daily-dig.yml` | Now runs `dig.py` **then** `synthesize.py` (so articles are generated after data is fetched). |
| `ui.js` | Now shows the server-generated AI articles on every device + uses the server's daily Founder quote. |
| `data/raw-industrial.json` | Now contains `ai_articles` + `founder_today` (regenerated for this zip). |
| `index.html` | Unchanged from the last version you uploaded — but re-upload it if you haven't yet (see below). |
| `data/content.json` | Unchanged. `ai-engine.js`, `data/seed-data.json` unchanged. |

---

## Your question answered: do you need to re-upload the new HTML/CSS?

**Yes — the `index.html` in your repo must be replaced with the new one in this zip.**

Why: since we started, we changed `index.html` (Footer branding, top bar "Support Cambreth
Intelligence", "Guardian" → ours, the Founder's Words section setup, etc.). All of that lives
in `index.html`.

**Important:** there is **no separate `.css` file** in our project. The Guardian CSS was merged
*inside* `index.html` earlier (in a big `<style>` block), and the new article/Founder/footer
styles are injected by `ui.js`. So:
- Uploading the new **`index.html`** updates the HTML **and** the CSS together.
- Uploading the new **`ui.js`** adds the styles for articles, Founder's Words, dividers, etc.

If you only re-upload `ui.js` but keep the OLD `index.html`, the new features will partially
work (styles come from `ui.js`) but the footer/top-bar/Guardian text fixes won't appear.
So: replace `index.html` too.

---

## How to upgrade on GitHub (web, no git needed)

### Step 1 — Download and unzip
Download the new `cambreth-site.zip` and unzip it (you'll get a `critical-synthesis` folder).

### Step 2 — Delete the old files first (GitHub blocks overwriting)
GitHub's web uploader **won't let you upload a file with the same name** as an existing one.
So remove the old ones first:
1. In your repo, open each of these files and click the **trash / Delete** icon (top-right of the file view), then confirm:
   - `index.html`
   - `ui.js`
   - `scripts/dig.py`
   - `data/raw-industrial.json`
   - `data/seed-data.json`
   - `.github/workflows/daily-dig.yml`
   - `README.md` and `INSTRUCTIONS.md` (optional — replace or keep)
2. You can leave these — they didn't change: `ai-engine.js`, `data/content.json` *(content.json is actually NEW — it was added last round; if it's already there, keep it; if not, it will come in Step 3)*.

> Tip: deleting one file at a time is fine. If you'd rather do it all in one go,
> you can delete the whole repo and recreate it — but then you'd need to redo
> GitHub Pages (Settings → Pages) and re-run the workflow once. The delete-file
> method keeps everything (Pages + Actions history) intact.

### Step 3 — Upload the new files
1. Repo → **Add file** → **Upload files**.
2. Drag in (from the unzipped `critical-synthesis` folder):
   - `index.html`
   - `ui.js`
   - `ai-engine.js`
   - `scripts/dig.py`
   - `scripts/synthesize.py`   ← the new one
   - `data/seed-data.json`
   - `data/raw-industrial.json`
   - `data/content.json`
   - `.github/workflows/daily-dig.yml`  ← drag the whole `.github` folder in
   - (optional) `README.md`, `INSTRUCTIONS.md`, `UPGRADE.md`
3. **Commit changes**.

### Step 4 — Re-run the daily machine once
1. Repo → **Actions** → **Daily Dig — Critical Minerals Intelligence**.
2. **Run workflow**.
3. Watch it pass: it should now show **two** Python steps — `dig.py` (fetch) and
   `synthesize.py` (generate articles) — then commit.
4. Wait ~1 min for GitHub Pages to rebuild, then refresh your site.

### Step 5 — Verify on your phone
Open your site on a **phone**. You should now see:
- A **"Daily market overview"** article (server-written) as the first card in the Markets/news section.
- That article **opens fully on the phone** at `#/article/daily-market-overview-…` with the Key Takeaway box.
- The Founder's Words shows **today's server-chosen quote**.
- Everything else: prices table, categories, subcategories, article pages, footer, images — all working.

---

## Optional: make the articles even richer with a free LLM
By default the server writes the articles with the built-in editorial engine (always works,
no keys). If you want the articles drafted by a hosted open model too:
1. Repo → **Settings → Secrets and variables → Actions → New repository secret**.
2. Name: `HF_TOKEN` · Value: a free Hugging Face token (huggingface.co → Settings → Access Tokens → create read token).
3. Next daily run will try the LLM for each category; if it ever fails, it automatically falls back to the built-in engine. Nothing breaks.

## Rollback
If anything looks wrong, delete `scripts/synthesize.py` from the repo and remove the
`synthesize` step from the workflow — the site still works with the editorial articles and
the in-browser AI. The signature layout is never touched.
