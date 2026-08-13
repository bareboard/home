# Unified Mineral Statistics Live — final deployment package

Upload the **contents** of this folder to the root of the GitHub Pages repository.

## Pages
- `index.html` / `home.html` — Unified Mineral Statistics Live
- `markets.html` / `market.html` — Market Intelligence
- `about.html` — About UMS LIVE
- `founder.html` — Fahadh Haneef Cambreth
- `holding-company.html` — Cambreth Group International

## Automated research operations
The workflow at `.github/workflows/daily-research-feed.yml` refreshes source-attributed articles, evidence scores, benchmarks and sector data every 15 minutes. In repository Settings → Actions → General, set Workflow permissions to **Read and write permissions**. GitHub Actions schedules can be delayed by GitHub; the workflow can also be run manually.

The frontend checks JSON data every five minutes and only animates values when a newly sourced snapshot differs from the prior sourced snapshot. It does not fabricate market movements.

## Source and image rules
Articles retain original publisher links and source attribution. A publisher image is shown only when available; unrelated stock imagery is not a valid substitute.

The future standalone article page is intentionally excluded.
