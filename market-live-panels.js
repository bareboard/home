/* UMS LIVE Market page: converts cloned empty ad inventory into sourced, current benchmark context without inventing values. */
(() => {
  'use strict';
  const dataUrl = () => `data/market-snapshot.json?v=${Date.now()}`;
  const direction = change => String(change || '').startsWith('−') || String(change || '').startsWith('-') ? 'is-down' : 'is-up';
  const panel = (slot, payload, index) => {
    const items = payload.benchmarks || [];
    if (!items.length || !slot) return;
    const offset = (index * 3) % items.length;
    const picks = [...items.slice(offset), ...items.slice(0, offset)].filter(item => item.change !== 'Watch').slice(0, 3);
    slot.classList.add('ums-market-live-panel');
    slot.dataset.umsMarketPanel = 'true';
    slot.innerHTML = '<div class="ums-market-panel-label">CURRENT MATERIAL SNAPSHOT</div><div class="ums-market-panel-title">VERIFIED MARKET BENCHMARKS</div><div class="ums-market-panel-grid"></div><div class="ums-market-panel-note"></div>';
    const grid = slot.querySelector('.ums-market-panel-grid');
    picks.forEach(item => {
      const cell = document.createElement('div');
      cell.className = 'ums-market-panel-cell';
      cell.innerHTML = `<span class="ums-market-panel-symbol">${item.symbol}</span><strong>${item.value}</strong><span class="${direction(item.change)}">${item.change}</span><small>${item.unit} · ${item.source}</small>`;
      grid.appendChild(cell);
    });
    slot.querySelector('.ums-market-panel-note').textContent = `Last verified: ${new Date(payload.generated_at).toLocaleString('en', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}. Values update only when a sourced assessment changes.`;
  };
  const render = payload => {
    const candidates = Array.from(document.querySelectorAll('main [data-testid="ad-container"]'))
      .filter(slot => !slot.closest('header, footer') && !slot.dataset.umsMarketPanel);
    candidates.forEach((slot, index) => panel(slot, payload, index));
  };
  const load = () => fetch(dataUrl(), { cache:'no-store' }).then(r => r.ok ? r.json() : Promise.reject()).then(render).catch(() => {});
  load();
  window.setTimeout(load, 1200);
  window.setInterval(load, 5 * 60 * 1000);
})();
