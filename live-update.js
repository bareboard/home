/* UMS LIVE live update renderer: uses the highest-ranked current research signal, never links away or uses an image. */
(() => {
  const pickHot = (articles) => {
    const weight = { policy: 4, supply: 3, market: 2, aggregates: 1 };
    return [...articles].sort((a, b) => ((b.evidence_score || 0) + (weight[b.research_signal] || 0)) - ((a.evidence_score || 0) + (weight[a.research_signal] || 0)))[0];
  };
  const render = (payload) => {
    // First in-stream native-ad slot: the visible gap between homepage news cards.
    const target = document.querySelector('main .native-ad.yf-4rju3x') || document.querySelector('main .native-ad');
    const hot = payload.live_article || pickHot(payload.articles || []);
    if (!target || !hot) return;
    target.classList.add('ums-live-slot');
    target.removeAttribute('id');
    target.innerHTML = '<div class="ums-live-kicker"><span class="ums-live-dot"></span>LIVE</div>' +
      '<div class="ums-live-headline"></div><p class="ums-live-summary"></p>';
    target.querySelector('.ums-live-headline').textContent = hot.title;
    target.querySelector('.ums-live-summary').textContent = hot.summary;
  };
  const load = () => fetch('data/daily-articles.json', { cache: 'no-store' })
    .then((response) => response.ok ? response.json() : Promise.reject())
    .then(render)
    .catch(() => {});
  load();
  window.setInterval(load, 30 * 60 * 1000);
})();
