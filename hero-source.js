/* UMS LIVE lead-story renderer: the homepage's large hero always uses the highest-ranked authentic source article. */
(() => {
  'use strict';
  const feedUrl = () => `data/daily-articles.json?v=${Date.now()}`;
  const dateLabel = value => {
    try { return new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value)); }
    catch { return ''; }
  };
  const render = payload => {
    const article = payload.live_article || (payload.articles || [])[0];
    const lead = document.querySelector('main [data-testid="hero-v2-container"] .lead-story');
    if (!article || !lead) return;
    const image = lead.querySelector('.visual img');
    const visual = lead.querySelector('.visual');
    const title = lead.querySelector('h1,h2,h3,h4');
    const summary = lead.querySelector('.summary');
    const publisher = lead.querySelector('.publisher');
    const published = lead.querySelector('.published-date');
    const links = lead.querySelectorAll('a');
    links.forEach(link => {
      link.href = article.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    });
    if (title) title.textContent = article.title;
    if (summary) summary.textContent = article.summary;
    if (publisher) publisher.textContent = article.source;
    if (published) published.textContent = article.published ? dateLabel(article.published) : '';
    if (image && article.image) {
      // The old clone image is held in srcset as well as src. Clear both before assigning a publisher image.
      image.removeAttribute('srcset');
      image.removeAttribute('sizes');
      image.src = article.image;
      image.alt = article.title;
      image.onerror = () => visual?.remove();
    } else {
      // No publisher image means no image — never leave the cloned Yahoo photo in the lead.
      visual?.remove();
    }
    lead.dataset.umsLiveSource = article.source;
  };
  const removeFallbackImage = () => document.querySelector('main [data-testid="hero-v2-container"] .lead-story .visual')?.remove();
  const load = () => fetch(feedUrl(), { cache: 'no-store' }).then(r => r.ok ? r.json() : Promise.reject()).then(render).catch(removeFallbackImage);
  load();
  window.setTimeout(load, 800);
  window.setTimeout(load, 2500);
  window.setInterval(load, 30 * 60 * 1000);
})();
