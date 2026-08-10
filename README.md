# UMS LIVE — deployment update

Upload the **contents** of this folder to the root of the existing GitHub repository, replacing matching files.

This update fixes two deployment-critical issues:
1. Every JSON request has a unique cache-busting query string, so a manual GitHub Actions refresh is read immediately rather than showing an old GitHub Pages/CDN response.
2. The article renderer now removes all clone/stock imagery. A story displays only an image supplied by its original publisher; missing or broken publisher images leave the story with no image.

The workflow is at `.github/workflows/daily-research-feed.yml`. After upload, set repository Settings → Actions → General → Workflow permissions to **Read and write permissions**, then run **Build UMS LIVE research feed** manually from the Actions tab.
