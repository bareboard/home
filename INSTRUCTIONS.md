# CAMBRETH INTELLIGENCE — Setup Instructions (exact steps)

Follow these top-to-bottom. Every file is already written and tested in this folder —
you only need to push them to your repository.

---

## Step 0 — Check what you have in this folder

```
critical-synthesis/
├── index.html                 ← YOUR SITE (already wired: #articles, #price-table, 2 script tags)
├── ai-engine.js               ← browser AI engine
├── ui.js                      ← auto-update glue
├── scripts/
│   └── dig.py                 ← daily data fetcher
├── data/
│   ├── raw-industrial.json    ← generated daily (already generated, committed)
│   └── seed-data.json         ← baseline fallback
├── .github/workflows/
│   └── daily-dig.yml          ← daily 07:00 UTC scheduler
├── README.md
└── INSTRUCTIONS.md            ← this file
```

---

## Step 1 — Put these files into your repository

You said you already created the repo (e.g. `YOURUSERNAME/critical-synthesis`).

**Option A (recommended):** copy this whole `critical-synthesis/` folder's *contents*
into your repo's root, replacing nothing you already have there except `index.html`.

**Option B:** if your repo is empty or you already pushed a copy:
1. Open your repo on GitHub.com.
2. Click **Add file → Upload files**.
3. Upload (preserving folders):
   - `index.html`, `ai-engine.js`, `ui.js`
   - `scripts/dig.py`
   - `data/raw-industrial.json`, `data/seed-data.json`
   - `.github/workflows/daily-dig.yml`  ← note: hidden folder, drag the whole `.github` folder
4. **Commit** ("Initial commit — Cambreth Intelligence").

> ⚠️ The most important thing: the repo root must contain `index.html`, `ai-engine.js`,
> `ui.js`, `scripts/`, `data/`, and `.github/workflows/` all in place. The two script tags
> in `index.html` point to `ai-engine.js` and `ui.js` — they must sit next to `index.html`.

---

## Step 2 — Turn on GitHub Pages

1. In your repo: **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **Deploy from a branch**.
3. Branch: **main** · Folder: **/ (root)** → **Save**.
4. Wait ~1 minute. Your site is live at:
   `https://YOURUSERNAME.github.io/critical-synthesis`

---

## Step 3 — Run the Daily Dig once (manual test)

1. In your repo, open the **Actions** tab.
2. Left panel: **Daily Dig — Critical Minerals Intelligence**.
3. Click **Run workflow** (the button) → **Run workflow**.
4. Watch it: it should show the steps green, ending with a summary like
   `Prices: 16 (7 live FRED) · Headlines: 8 · Chemistry: 6`.

From then on it runs itself at **07:00 UTC every day**.

---

## Step 4 — Test your live site

1. Open `https://YOURUSERNAME.github.io/critical-synthesis` (or your Pages URL).
2. You should see:
   - **Markets — Daily Prices & Analytics** section with the price table (8 columns).
   - The first article grid filled with today's **Daily Industry Brief** headlines.
   - The AI (Chrome/Edge desktop) auto-writing deep articles into that grid within a
     minute or two on first visit (model downloads once, then cached).
3. No buttons to press — everything auto-updates.

---

## Step 5 — Editing the site later (what NOT to break)

- Keep the element IDs **`#price-table`** and **`#articles`** in `index.html` — that's
  where the daily content lands.
- Keep these two lines right before `</body>`:
  ```html
  <script type="module" src="ai-engine.js"></script>
  <script src="ui.js"></script>
  ```
- Anything else is yours to change freely — theme, sections, layout.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| No table / "Loading daily prices…" | Data file missing or 404 → run the workflow once (Step 3), then hard-refresh. |
| No headlines in the grid | Same — the RSS feed data lives in `raw-industrial.json`; rerun the workflow. |
| "Model load failed / WebGPU" in console | That's the graceful fallback — prices + headlines still show. Full AI needs desktop Chrome/Edge with WebGPU. First load downloads ~1–2 GB once. |
| IndexedDB error in console | Harmless — the cache just wasn't created yet on an old tab. Refresh. |
| Workflow fails at "Commit fresh data" | Your Actions permission needs `contents: write` (it's in the YAML already). If the repo setting blocks it, allow Actions write permissions in **Settings → Actions → General → Workflow permissions → Read and write**. |

---

## Architecture in one line

`GitHub Actions (07:00 UTC) → dig.py → data/raw-industrial.json → committed →
your page fetches it → ui.js renders prices + headlines → ai-engine.js (WebGPU)
auto-writes deep articles into #articles → IndexedDB cache → refresh every 30 min.`
