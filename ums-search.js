/* UMS LIVE local search: mineral topics, current benchmarks, and sourced research articles. */
(() => {
  const form = document.querySelector('#ybar-sf');
  const input = document.querySelector('#ybar-sbq');
  const header = document.querySelector('#nimbus-app > header.hideOnPrint');
  if (!form || !input) return;

  const container = form.closest('.ybar-search-box-container');
  const results = document.createElement('div');
  results.className = 'ums-search-results';
  results.setAttribute('role', 'listbox');
  results.setAttribute('aria-label', 'UMS LIVE search results');
  container.appendChild(results);

  const topics = [
    ['Lithium Carbonate', 'Market benchmark · battery materials', '#/market/lithium'],
    ['Cobalt', 'Market benchmark · battery materials', '#/market/cobalt'],
    ['Copper', 'Market benchmark · grid and electrification', '#/market/copper'],
    ['Nickel', 'Market benchmark · battery materials', '#/market/nickel'],
    ['Rare Earths', 'Market benchmark · magnets and supply chains', '#/market/rare-earths'],
    ['Graphite Anodes', 'Market benchmark · battery materials', '#/market/graphite'],
    ['Gallium', 'Market benchmark · strategic minor minerals', '#/market/gallium'],
    ['Construction Aggregates', 'Regional materials intelligence', '#/market/aggregates'],
    ['China & East Asia', 'Regional mineral exposure', '#/markets'],
    ['DRC & Central Africa', 'Regional mineral exposure', '#/markets'],
    ['Indonesia & ASEAN', 'Regional mineral exposure', '#/markets']
  ];
  let articles = [];

  const escapeHtml = value => String(value).replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' })[c]);
  const close = () => { results.classList.remove('is-open'); results.replaceChildren(); };
  const choose = item => {
    input.value = item.title;
    close();
    if (item.url && item.url.startsWith('http')) window.open(item.url, '_blank', 'noopener,noreferrer');
    else if (item.url) window.location.hash = item.url.replace(/^#/, '');
  };
  const render = query => {
    const q = query.trim().toLowerCase();
    if (!q) return close();
    const topicMatches = topics.filter(([title, detail]) => `${title} ${detail}`.toLowerCase().includes(q))
      .map(([title, detail, url]) => ({ title, detail, url }));
    const articleMatches = articles.filter(article => `${article.title || ''} ${article.summary || ''}`.toLowerCase().includes(q))
      .map(article => ({ title: article.title, detail: `Source: ${article.source || 'Publisher'}`, url: article.url }));
    const matches = [...topicMatches, ...articleMatches].slice(0, 6);
    results.innerHTML = matches.length ? matches.map((item, index) => `<button class="ums-search-result" type="button" role="option" data-result="${index}"><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.detail)}</small></button>`).join('') : '<div class="ums-search-empty">No UMS LIVE result found. Try lithium, copper, graphite, rare earths, or aggregates.</div>';
    results.classList.add('is-open');
    results.querySelectorAll('[data-result]').forEach(button => button.addEventListener('click', () => choose(matches[Number(button.dataset.result)])));
  };

  input.placeholder = 'Search minerals, regions, or research';
  input.addEventListener('input', () => render(input.value));
  input.addEventListener('focus', () => { if (input.value.trim()) render(input.value); });
  form.addEventListener('submit', event => { event.preventDefault(); render(input.value); const first = results.querySelector('[data-result]'); if (first) first.focus(); });
  document.addEventListener('click', event => { if (!container.contains(event.target)) close(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });

  fetch('data/daily-articles.json').then(response => response.ok ? response.json() : null).then(payload => {
    if (!payload) return;
    articles = [payload.live_article, ...(payload.articles || [])].filter(Boolean);
  }).catch(() => { /* Topic and benchmark responses remain available without a feed request. */ });

  // The fixed mobile header is removed from normal flow, so keep the page start
  // precisely below its measured height at every responsive size.
  const syncMobileHeaderHeight = () => {
    if (!header) return;
    document.documentElement.style.setProperty('--ums-mobile-header-height', `${Math.ceil(header.getBoundingClientRect().height)}px`);
  };
  syncMobileHeaderHeight();
  window.addEventListener('resize', syncMobileHeaderHeight, { passive: true });
  if (window.ResizeObserver && header) new ResizeObserver(syncMobileHeaderHeight).observe(header);
})();
