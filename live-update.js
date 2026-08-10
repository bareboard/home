/* UMS LIVE live update renderer: uses the highest-ranked current research signal, never links away or uses an image. */
(() => {
  const pickHot = (articles) => {
    const weight = { policy: 4, supply: 3, market: 2, aggregates: 1 };
    return [...articles].sort((a, b) => ((b.evidence_score || 0) + (weight[b.research_signal] || 0)) - ((a.evidence_score || 0) + (weight[a.research_signal] || 0)))[0];
  };
  const render = (payload) => {
    // First in-stream native-ad slot: the visible gap between homepage news cards.
    const target = document.querySelector('main .ums-live-slot') || document.querySelector('main .native-ad.yf-4rju3x') || document.querySelector('main .native-ad');
    const hot = payload.live_article || pickHot(payload.articles || []);
    if (!target || !hot) return;
    target.classList.add('ums-live-slot');
    target.dataset.umsPanel = 'live';
    target.innerHTML = '<div class="ums-live-kicker"><span class="ums-live-dot"></span>LIVE</div>' +
      '<div class="ums-live-headline"></div><p class="ums-live-summary"></p>';
    target.querySelector('.ums-live-headline').textContent = hot.title;
    target.querySelector('.ums-live-summary').textContent = hot.summary;
  };
  const load = () => fetch(`data/daily-articles.json?v=${Date.now()}`, { cache: 'no-store' })
    .then((response) => response.ok ? response.json() : Promise.reject())
    .then(render)
    .catch(() => {});
  // Clone ad containers can arrive after the page scripts; retry briefly so the LIVE panel always restores into its reserved slot.
  load();
  window.setTimeout(load, 800);
  window.setTimeout(load, 2500);
  window.setTimeout(load, 5000);
  window.setInterval(load, 30 * 60 * 1000);
})();
