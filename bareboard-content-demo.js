/* [DEMO] UMS LIVE research-led content adapter. Replace these static datasets with the daily research/AI feed without changing the cloned Yahoo layout. */
(() => {
  'use strict';

  /* [DEMO] This component is a Market Quote / Table Row / Carousel Card. Benchmarks sourced from current public mineral assessments and market references. */
  const DEMO_QUOTES = [
    ['LITH', 'Lithium Carbonate', '142,750', '+0.88%'],
    ['COB', 'Cobalt Metal', '56,290', '+0.00%'],
    ['NICK', 'Nickel Cathode', '19,694.69', '+1.48%'],
    ['CU', 'Copper Cathode', '15,779.37', '+0.73%'],
    ['NDPR', 'NdPr Oxide', '97,400.79', '−11.9%'],
    ['GPH', 'Natural Graphite', '1,728.10', '+0.00%'],
    ['GA', 'Gallium', '1,825.00', '+1.67%'],
    ['SN', 'Tin Ingot', '63,232.65', '+0.44%'],
    ['ZN', 'Zinc Ingot', '3,679.10', '−0.72%'],
    ['AL', 'Aluminum Ingot', '3,503.41', '+0.94%'],
    ['AGG', 'Crushed Aggregate', '13.90', '+0.00%'],
    ['SAND', 'Construction Sand', '—', 'Watch']
  ];

  /* [DEMO] This component is a Main News / Secondary Story / Related Story Card. */
  const DEMO_HEADLINES = [
    'DRC Cobalt Concentrate Controls Raise Refining and Delivery Risk',
    'Lithium Rebounds as Storage Demand Tests Supply',
    'Copper Buyers Reprice Logistics and Smelter Constraints',
    'Graphite Anode Capacity Becomes the New Chokepoint',
    'Rare Earth Prices Reset Below Policy Floor',
    'Nickel Cost Curves Put High-Cost Mines on Watch',
    'Aggregate Supply Tightens Near Major Infrastructure Corridors',
    'Recycled Aggregates Gain Ground in Municipal Procurement',
    'Battery Makers Split Between LFP and Nickel-Rich Cells',
    'Critical Minerals Buyers Add Traceability to Offtakes',
    'Processing Capacity Lags New Mine Announcements',
    'Construction Sand Supply Faces New Permitting Pressure',
    'Magnet Supply Security Moves Beyond Rare Earth Mining',
    'Cobalt Quotas Shift Material Into Controlled Inventories',
    'Copper Grade Decline Sharpens Project Delivery Risk',
    'Mineral Finance Turns Toward Long-Term Contract Quality',
    'Battery Recycling Feedstock Becomes a Procurement Signal',
    'Crushed Stone Demand Tracks Roads, Rail and Grid Buildout',
    'Mineral Markets Weigh Policy Risk Against New Capacity',
    'Aggregates Producers Invest in Recycled Material Systems'
  ];

  /* [DEMO] This component is a Story Summary / Article Deck / Analysis Paragraph. */
  const DEMO_SUMMARIES = [
    'Controls on concentrate flows can lengthen refinery delivery cycles and increase the importance of inventory coverage, alternative feedstock and port logistics across the cobalt value chain.',
    'The price move reflects a wider contest between new capacity, inventory, energy costs and policy risk across the mineral value chain.',
    'Buyers are increasingly evaluating chemical form, traceability, contract terms and route reliability rather than relying on headline production alone.',
    'Infrastructure demand supports aggregate volumes, while permitting, haul distance, recycled content and quarry capacity shape local pricing.',
    'Battery chemistry is reshaping mineral intensity: LFP reduces cobalt and nickel exposure, while graphite and lithium remain central to cell manufacturing.',
    'UMS LIVE tracks the assumptions behind each market view, including the evidence that could invalidate the scenario.'
  ];

  /* [DEMO] This component is a Navigation / Section Label / Screen Name. */
  const DEMO_LABELS = new Map([
    ['Yahoo Finance', 'UMS LIVE'],
    ['Markets', 'Mineral Markets'],
    ['Stocks', 'Producers'],
    ['Stock', 'Producer'],
    ['News', 'Mineral Intelligence'],
    ['Commodities', 'Critical Minerals'],
    ['Cryptocurrencies', 'Battery Materials'],
    ['Cryptocurrency', 'Battery Materials'],
    ['Crypto', 'Battery Materials'],
    ['ETFs', 'Regional Mineral Exposure'],
    ['Top ETFs', 'Regional Mineral Exposure'],
    ['Top Gainers', 'DRC & Central Africa'],
    ['Top Losers', 'Indonesia & ASEAN'],
    ['Most Active', 'China & East Asia'],
    ['Top Performing', 'Americas & Australia'],
    ['Trending Now', 'Global Mineral Signals'],
    ['World Indices', 'Global Mineral Benchmarks'],
    ['Currencies', 'Trade & Freight'],
    ['Bonds', 'Project Finance'],
    ['Futures', 'Forward Curves'],
    ['Personal Finance', 'Supply Chain Finance'],
    ['Latest News', 'Latest Intelligence'],
    ['Videos', 'Research Briefings'],
    ['Watch Now', 'Live Signals'],
    ["Editor's picks", 'Research Priorities'],
    ['Trending stocks', 'Regional Signals']
  ]);

  const replaceExactLabels = () => {
    document.querySelectorAll('h1,h2,h3,h4,h5,button,a,span,p,li').forEach((node) => {
      if (node.children.length !== 0) return;
      const text = node.textContent.trim();
      if (DEMO_LABELS.has(text)) node.textContent = DEMO_LABELS.get(text);
    });
  };

  const cycle = (nodes, data, condition = () => true) => {
    let index = 0;
    nodes.forEach((node) => {
      if (!condition(node)) return;
      node.textContent = data[index++ % data.length];
    });
  };

  /* [DEMO] Article and news-card swapping. */
  const articleHeads = Array.from(document.querySelectorAll('main article h1, main article h2, main article h3, main article h4, main [data-testid*="story"] h1, main [data-testid*="story"] h2, main [data-testid*="story"] h3, main [data-testid*="story"] h4'));
  cycle(articleHeads, DEMO_HEADLINES);
  const articleText = Array.from(document.querySelectorAll('main article p, main [data-testid*="story"] p'));
  cycle(articleText, DEMO_SUMMARIES, (node) => node.textContent.trim().length > 45);

  /* [DEMO] Quote-card and market-table swapping. */
  let quoteIndex = 0;
  document.querySelectorAll('[data-testid="card-container"], [data-testid="data-table-v2"] tr').forEach((container) => {
    const quote = DEMO_QUOTES[quoteIndex++ % DEMO_QUOTES.length];
    const symbol = container.querySelector('.symbol');
    const longName = container.querySelector('.longName');
    const value = container.querySelector('.moreInfo strong, td:nth-child(3), td:nth-child(2)');
    const change = container.querySelector('.changes, td:last-child');
    if (symbol) symbol.textContent = quote[0];
    if (longName) longName.textContent = quote[1];
    if (value) value.textContent = quote[2];
    if (change) {
      change.textContent = quote[3];
      change.classList.toggle('txt-negative', quote[3].startsWith('−'));
      change.classList.toggle('txt-positive', quote[3].startsWith('+'));
    }
  });

  /* [DEMO] Generic headings and article-like links that are not wrapped in semantic article markup. */
  const headings = Array.from(document.querySelectorAll('main h1, main h2, main h3, main h4'));
  cycle(headings, DEMO_HEADLINES, (node) => !DEMO_LABELS.has(node.textContent.trim()) && node.textContent.trim().length > 12);

  /* [DEMO] Internal route transformation: all cloned Yahoo destinations become UMS LIVE research routes. */
  let linkIndex = 0;
  document.querySelectorAll('a[href*="yahoo"], a[href^="/quote/"], a[href^="/markets/"]').forEach((link) => {
    const slug = DEMO_HEADLINES[linkIndex++ % DEMO_HEADLINES.length].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    link.setAttribute('href', '#/research/' + slug);
  });

  /* [DEMO] Brand and metadata swap. */
  document.title = 'Unified Mineral Statistics Live';
  document.querySelectorAll('[aria-label="Yahoo Finance"], [title="Yahoo Finance"]').forEach((node) => {
    node.setAttribute('aria-label', 'UMS LIVE');
    if (node.hasAttribute('title')) node.setAttribute('title', 'UMS LIVE');
  });
  document.querySelectorAll('meta[name="description"], meta[property="og:description"], meta[name="twitter:description"]').forEach((node) => {
    node.setAttribute('content', 'UMS LIVE tracks critical minerals, battery materials, construction aggregates, supply chains and research-led market signals.');
  });

  replaceExactLabels();

  /* [DEMO] Final visible-brand and residual finance-label sweep; scripts and styles are deliberately excluded. */
  const residual = [
    ['Yahoo Finance Video', 'UMS LIVE Market Briefing'],
    ['New on Yahoo', 'New on UMS LIVE'],
    ['Copyright © 2026 Yahoo. All rights reserved.', '© 2026 The Cambreth Organization. All rights reserved.'],
    ['Dow Jones', 'Copper Producers'],
    ['S&P 500', 'Critical Minerals Basket'],
    ['Nasdaq', 'Battery Materials Basket'],
    ['Bitcoin', 'Graphite Anode'],
    ['Ethereum', 'Rare Earth Basket'],
    ['Watch Now', 'Live Signals'],
    ['Videos', 'Research Briefings']
  ];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);
  textNodes.forEach((node) => {
    const parent = node.parentElement;
    if (!parent || /^(SCRIPT|STYLE)$/i.test(parent.tagName)) return;
    let value = node.nodeValue;
    residual.forEach(([from, to]) => { value = value.replaceAll(from, to); });
    node.nodeValue = value;
  });
})();
