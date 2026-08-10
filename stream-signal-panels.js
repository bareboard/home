/* UMS LIVE in-stream research panels. They use current evidence and market data without duplicating source article cards or linking away. */
(() => {
  const topicLabel = (topic) => ({
    lithium: 'LITHIUM', cobalt: 'COBALT', nickel: 'NICKEL', copper: 'COPPER', graphite: 'GRAPHITE',
    'rare-earths': 'RARE EARTHS', aggregates: 'CONSTRUCTION AGGREGATES', 'critical-minerals': 'CRITICAL MINERALS'
  }[topic] || 'CRITICAL MINERALS');
  const prettySignal = (signal) => ({ policy: 'POLICY', supply: 'SUPPLY', market: 'MARKET', aggregates: 'AGGREGATES' }[signal] || 'RESEARCH');
  const fillContext = (slot, article) => {
    slot.classList.add('ums-context-slot');
    slot.removeAttribute('id');
    slot.innerHTML = '<div class="ums-panel-kicker">VALUE CHAIN NOTE</div><div class="ums-panel-title"></div><p class="ums-panel-summary"></p>';
    slot.querySelector('.ums-panel-title').textContent = `${topicLabel(article.topic)}: WHAT THE MARKET IS WATCHING`;
    slot.querySelector('.ums-panel-summary').textContent = `This update is being monitored through the UMS LIVE source system for implications across supply, processing, logistics and customer delivery. The next material change will be reflected in the current research feed.`;
  };
  const fillSignal = (slot, article) => {
    slot.classList.add('ums-signal-slot');
    slot.removeAttribute('id');
    slot.innerHTML = '<div class="ums-panel-kicker">RESEARCH SIGNAL</div><div class="ums-panel-title"></div><p class="ums-panel-summary"></p><div class="ums-panel-meta"></div>';
    slot.querySelector('.ums-panel-title').textContent = `${prettySignal(article.research_signal)} WATCH: ${topicLabel(article.topic)}`;
    slot.querySelector('.ums-panel-summary').textContent = `Current source evidence flags a ${String(article.research_signal || 'market').toLowerCase()} development in ${topicLabel(article.topic).toLowerCase()}. UMS LIVE is monitoring delivery conditions, processing capacity and regional exposure as the signal develops.`;
    slot.querySelector('.ums-panel-meta').textContent = `EVIDENCE SCORE ${article.evidence_score || '—'}/100 · ${String(article.confidence || 'developing').toUpperCase()} CONFIDENCE`;
  };
  const fillMovers = (slot, benchmarks) => {
    const numeric = (item) => Number(String(item.change || '').replace(/[+−%]/g, '').replace('Watch', '0')) || 0;
    const movers = [...benchmarks].filter((item) => item.change !== 'Watch').sort((a, b) => Math.abs(numeric(b)) - Math.abs(numeric(a))).slice(0, 3);
    slot.classList.add('ums-movers-slot');
    slot.removeAttribute('id');
    slot.innerHTML = '<div class="ums-panel-kicker">MATERIAL MOVERS</div><div class="ums-panel-title">CURRENT PRICE & MOMENTUM</div><div class="ums-movers-row"></div>';
    const row = slot.querySelector('.ums-movers-row');
    movers.forEach((item) => {
      const down = String(item.change).startsWith('−') || String(item.change).startsWith('-');
      const box = document.createElement('div');
      box.className = 'ums-mover';
      box.innerHTML = `<div class="ums-mover-name">${item.symbol}</div><div class="ums-mover-value">${item.value}</div><div class="ums-mover-change ${down ? 'is-down' : 'is-up'}"><span class="ums-mover-arrow"></span>${item.change}</div>`;
      row.appendChild(box);
    });
  };
  const fillPulse = (slot, benchmarks) => {
    const picks = ['lithium', 'nickel', 'rare-earths'].map((topic) => benchmarks.find((item) => item.topic === topic)).filter(Boolean);
    slot.classList.add('ums-pulse-slot');
    slot.removeAttribute('id');
    slot.innerHTML = '<div class="ums-panel-kicker">MARKET PULSE</div><div class="ums-panel-title">TODAY’S MATERIAL SIGNALS</div><p class="ums-panel-summary">A compact view of the current UMS LIVE benchmark snapshot across battery materials and magnet minerals.</p><div class="ums-pulse-grid"></div>';
    const grid = slot.querySelector('.ums-pulse-grid');
    picks.forEach((item) => {
      const metric = document.createElement('div');
      metric.className = 'ums-pulse-metric' + ((item.change || '').startsWith('−') ? ' is-down' : '');
      metric.textContent = `${item.symbol} ${item.value}`;
      const change = document.createElement('span');
      change.textContent = item.change;
      metric.appendChild(change);
      grid.appendChild(metric);
    });
  };
  const load = async () => {
    try {
      const [articles, market] = await Promise.all([
        fetch(`data/daily-articles.json?v=${Date.now()}`, {cache:'no-store'}).then((r) => r.json()),
        fetch(`data/market-snapshot.json?v=${Date.now()}`, {cache:'no-store'}).then((r) => r.json())
      ]);
      const contextSlot = document.querySelector('main #sda-MID-CENTER-global-1') || document.querySelector('main .ntv-insert .native-ad');
      const moversSlot = document.querySelector('main #sda-NEWS-STREAM-stream-1');
      const slots = Array.from(document.querySelectorAll('main .native-ad.yf-4rju3x'));
      if (contextSlot && articles.articles?.[0]) fillContext(contextSlot, articles.articles[0]);
      if (slots[1] && articles.articles?.[0]) fillSignal(slots[1], articles.articles[0]);
      if (moversSlot && market.benchmarks) fillMovers(moversSlot, market.benchmarks);
      if (slots[2] && market.benchmarks) fillPulse(slots[2], market.benchmarks);
    } catch (_) { /* Existing layout remains intact if a data file is temporarily unavailable. */ }
  };
  // Restore panels even when clone ad containers are inserted a moment after page parsing.
  load();
  window.setTimeout(load, 800);
  window.setTimeout(load, 2500);
  window.setTimeout(load, 5000);
  window.setInterval(load, 30 * 60 * 1000);
})();
