# UMS LIVE — GitHub Pages deployment package

This folder is deployment-ready. Upload **the contents of this folder** to the root of the UMS LIVE GitHub repository (not this enclosing folder itself).

## Entry pages
- `index.html` — GitHub Pages root homepage
- `home.html` — homepage alias
- `markets.html` — Market page used by the three-dot navigation
- `market.html` — retained Market-page alias

## Automated data refresh
`.github/workflows/daily-research-feed.yml` refreshes the source-attributed research feed, mineral market snapshot, and sector heatmap every hour. GitHub Pages must be enabled for the repository, and Actions must have permission to write repository contents.

## Included data system
- `scripts/build_article_feed.py` — authentic publisher feed collection and ranking
- `scripts/build_evidence_signals.py` — transparent evidence labels
- `scripts/build_market_snapshot.py` — current mineral benchmark snapshot
- `scripts/build_sector_heatmap.py` — sector-map data
- `data/` — latest generated data, available immediately on first deployment

The future standalone article template is deliberately not included, as requested. Source article cards open the original publisher URL in a new tab.
