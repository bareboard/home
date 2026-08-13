/* [DEMO] This component is an Article Context Indicator. It selects a mineral benchmark based on the article's subject. */
(() => {
  'use strict';

  /* [DEMO] Dated public benchmark context: August 2026. Backend research will replace only this dataset. */
  const DEMO_INDICATORS = {
    lithium: { symbol: 'LITH', value: '142,750', change: '+0.88%', route: 'lithium-carbonate' },
    cobalt: { symbol: 'COB', value: '56,290', change: '+0.00%', route: 'cobalt' },
    copper: { symbol: 'CU', value: '15,779.37', change: '+0.73%', route: 'copper' },
    nickel: { symbol: 'NICK', value: '19,694.69', change: '+1.48%', route: 'nickel' },
    graphite: { symbol: 'GPH', value: '1,728.10', change: '+0.00%', route: 'graphite' },
    rareearth: { symbol: 'NDPR', value: '97,400.79', change: '−11.9%', route: 'ndpr-oxide' },
    aggregates: { symbol: 'AGG', value: '13.90', change: '+0.00%', route: 'construction-aggregates' },
    minerals: { symbol: 'CMI', value: '86', change: '+0.00%', route: 'supply-concentration' }
  };

  const contextFor = (text) => {
    const t = text.toLowerCase();
    if (/lithium|brine|carbonate|spodumene|lce/.test(t)) return DEMO_INDICATORS.lithium;
    if (/cobalt|congo|drc/.test(t)) return DEMO_INDICATORS.cobalt;
    if (/copper|smelter|grid|grade/.test(t)) return DEMO_INDICATORS.copper;
    if (/nickel|nmc/.test(t)) return DEMO_INDICATORS.nickel;
    if (/graphite|anode/.test(t)) return DEMO_INDICATORS.graphite;
    if (/rare earth|magnet|ndpr|neodymium|praseodymium/.test(t)) return DEMO_INDICATORS.rareearth;
    if (/aggregate|sand|gravel|quarry|crushed stone|infrastructure/.test(t)) return DEMO_INDICATORS.aggregates;
    return DEMO_INDICATORS.minerals;
  };

  /* [DEMO] Article indicator: preserve the cloned ticker-pill behavior and replace only the symbol/value/change. */
  document.querySelectorAll('.tickers').forEach((tickerGroup) => {
    const scope = tickerGroup.closest('article, .story-item, li, section') || tickerGroup.parentElement;
    const data = contextFor(scope.textContent || '');
    tickerGroup.querySelectorAll('.ticker-link').forEach((link, index) => {
      const current = index === 0 ? data : DEMO_INDICATORS.minerals;
      const symbol = link.querySelector('.symbol');
      const change = link.querySelector('.positive, .negative, .changes');
      link.querySelectorAll('.article-context-value').forEach((value) => value.remove());
      if (symbol) {
        symbol.textContent = current.symbol;
        const value = document.createElement('span');
        value.className = 'article-context-value';
        value.textContent = ' ' + current.value;
        symbol.insertAdjacentElement('afterend', value);
      }
      if (change) {
        change.textContent = current.change;
        change.classList.toggle('positive', current.change.startsWith('+'));
        change.classList.toggle('negative', current.change.startsWith('−') || current.change.startsWith('-'));
      }
      link.href = '#/market/' + current.route;
      link.setAttribute('aria-label', current.symbol + ' ' + current.change);
      link.title = current.symbol + ' ' + current.value;
    });
  });
})();
