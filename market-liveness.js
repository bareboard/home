/* UMS LIVE market-state layer: exposes freshness and source-backed activity without manufacturing movement. */
(() => {
  'use strict';
  document.title = 'Unified Mineral Statistics Live | Market Intelligence';
  const url = () => `data/market-snapshot.json?v=${Date.now()}`;
  const stamp = iso => {
    try { return new Intl.DateTimeFormat('en', { hour:'2-digit', minute:'2-digit', day:'numeric', month:'short' }).format(new Date(iso)); }
    catch { return 'current session'; }
  };
  const render = payload => {
    const message = `UMS LIVE · verified ${stamp(payload.generated_at)}`;
    document.querySelectorAll('main section[data-testid] > header').forEach(header => {
      let badge = header.querySelector('.ums-market-freshness');
      if (!badge) { badge=document.createElement('span'); badge.className='ums-market-freshness'; header.appendChild(badge); }
      badge.textContent=message;
    });
    document.documentElement.dataset.umsMarketGenerated=payload.generated_at || '';
  };
  const load=()=>fetch(url(),{cache:'no-store'}).then(r=>r.ok?r.json():Promise.reject()).then(render).catch(()=>{});
  load();window.setInterval(load,30*60*1000);
})();
