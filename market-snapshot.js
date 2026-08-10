/* UMS LIVE market snapshot renderer. Values, country/region views and rankings are produced by scripts/build_market_snapshot.py. */
(() => {
  const changeValue = (item) => Number(String(item.change).replace(/[+−%]/g, '').replace('Watch', '0')) || 0;
  const writeQuote = (container, item) => {
    const symbol = container.querySelector('.symbol');
    const longName = container.querySelector('.longName');
    const value = container.querySelector('.moreInfo strong, td:nth-child(3), td:nth-child(2)');
    const change = container.querySelector('.changes, td:last-child');
    if (symbol) symbol.textContent = item.symbol;
    if (longName) longName.textContent = item.name;
    if (value) value.textContent = item.value;
    if (change) {
      change.textContent = item.change;
      change.classList.toggle('txt-positive', item.change.startsWith('+'));
      change.classList.toggle('txt-negative', item.change.startsWith('−') || item.change.startsWith('-'));
    }
  };
  const updateTableRows = (scope, items) => {
    let index = 0;
    scope.querySelectorAll('[data-testid="data-table-v2"] tr').forEach((row) => {
      const item = items[index++ % items.length];
      const quoteLink = row.querySelector('a.loud-link, a[href*="/quote/"]');
      if (quoteLink) {
        quoteLink.textContent = item.symbol;
        quoteLink.href = '#/market/' + item.topic;
        quoteLink.title = item.name;
        quoteLink.setAttribute('aria-label', item.name);
      }
      const cells = row.querySelectorAll('td');
      if (cells.length >= 2) cells[1].textContent = item.name;
      if (cells.length >= 3) cells[2].textContent = item.value;
      if (cells.length >= 4) cells[cells.length - 1].textContent = item.change;
    });
  };
  const renderRegionalViews = (views, benchmarks) => {
    const containers = Array.from(document.querySelectorAll('section[data-testid="etfs"]'));
    containers.forEach((section, index) => {
      const view = views[index % views.length];
      const heading = section.querySelector('h3,h4');
      if (heading) heading.textContent = view.region;
      const regional = view.topics.map((topic) => benchmarks.find((item) => item.topic === topic)).filter(Boolean);
      updateTableRows(section, regional.length ? regional : benchmarks);
    });
    document.querySelectorAll('section[data-testid="etf"] > header h3').forEach((heading) => {
      heading.textContent = 'Regional Mineral Exposure';
    });
  };
  const render = (payload) => {
    const items = payload.benchmarks || [];
    if (!items.length) return;
    let index = 0;
    document.querySelectorAll('[data-testid="card-container"]').forEach((container) => writeQuote(container, items[index++ % items.length]));
    renderRegionalViews(payload.regional_views || [], items);
    updateTableRows(document, items);
  };
  const load = () => fetch(`data/market-snapshot.json?v=${Date.now()}`, {cache:'no-store'})
    .then(r => r.ok ? r.json() : Promise.reject())
    .then(render)
    .catch(() => {});
  load();
  window.setInterval(load, 30 * 60 * 1000);
})();
