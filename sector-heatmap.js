/* UMS LIVE Sector Map: updates the cloned Yahoo heatmap from data/sector-heatmap.json and provides a working sector picker. */
(() => {
  const layouts = [
    [0,0,46,62], [46,0,30,40], [76,0,24,40], [46,40,30,33], [76,40,24,33], [0,62,27,38], [27,62,19,38]
  ];
  const colorFor = (momentum) => {
    if (momentum >= 2) return 'var(--color-interactive-heatmap-2-pos-enabled)';
    if (momentum > 0) return 'var(--color-interactive-heatmap-1-pos-enabled)';
    if (momentum <= -2) return 'var(--color-interactive-heatmap-2-neg-enabled)';
    if (momentum < 0) return 'var(--color-interactive-heatmap-1-neg-enabled)';
    return 'var(--color-interactive-heatmap-0-neutral-enabled)';
  };
  const pct = (value) => `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(2)}%`;
  const render = (payload) => {
    const root = document.querySelector('section[data-testid="sectors"]');
    if (!root || !payload.sectors?.length) return;
    const sectors = payload.sectors;
    const mainHeading = root.querySelector(':scope > header h3');
    if (mainHeading) mainHeading.textContent = 'UMS LIVE Sector Map';
    const label = root.querySelector('.labelContainer h3');
    if (label) label.textContent = 'Select a UMS LIVE sector for a visual breakdown';
    const table = root.querySelector('[data-testid="sector-picker"] table');
    if (table) {
      const headers = table.querySelectorAll('thead th');
      if (headers[0]) headers[0].textContent = 'Sector';
      if (headers[1]) headers[1].textContent = 'Signal Weight';
      if (headers[2]) headers[2].textContent = '24h Momentum';
      const tbody = table.querySelector('tbody');
      if (tbody) tbody.innerHTML = sectors.map((s, i) => `<tr tabindex="0" class="yf-eivjfp${i===0?' selected':''}" data-sector="${s.name}"><td class="name yf-eivjfp">${s.name}</td><td class="barContainer yf-eivjfp" colspan="2"><div class="barBg yf-eivjfp"><div class="bar yf-eivjfp" style="width:${s.signal_weight}%"></div></div><span class="yf-eivjfp">${s.signal_weight.toFixed(2)}%</span></td><td class="disappear ${s.momentum>=0?'positive':'negative'} yf-eivjfp">${pct(s.momentum)}</td></tr>`).join('');
    }
    const heatmap = root.querySelector('.heatMap-container');
    if (heatmap) {
      heatmap.innerHTML = sectors.map((s, i) => {
        const [left, top, width, height] = layouts[i] || layouts[layouts.length-1];
        return `<a id="ums-${i}" data-sector="${s.name}" class="rect-container yf-1x5pmid" href="#/sector/${s.name.toLowerCase().replace(/[^a-z0-9]+/g,'-')}" style="--left-percent:${left}%;--top-percent:${top}%;--width-percent:${width}%;--height-percent:${height}%;--color:${colorFor(s.momentum)};--pressed-color:${colorFor(s.momentum)};--hover-color:${colorFor(s.momentum)}" aria-label="Heatmap region for ${s.name}"><span class="ticker-div yf-1x5pmid m-word" style="--line-num:2">${s.name}</span><span class="percent-div yf-1x5pmid">${pct(s.momentum)}</span></a>`;
      }).join('');
    }
    const button = root.querySelector('[data-testid="sector-picker"] button');
    if (!button) return;
    const text = button.querySelector('.textSelect') || button;
    text.textContent = 'All UMS LIVE Sectors';
    const menu = document.createElement('div');
    menu.className = 'ums-sector-menu';
    menu.innerHTML = `<button type="button" data-sector="">All UMS LIVE Sectors</button>` + sectors.map((s) => `<button type="button" data-sector="${s.name}">${s.name}</button>`).join('');
    document.body.appendChild(menu);
    const select = (name) => {
      text.textContent = name || 'All UMS LIVE Sectors';
      root.querySelectorAll('.heatMap-container .rect-container').forEach((cell) => { cell.style.opacity = !name || cell.dataset.sector === name ? '1' : '.22'; });
      root.querySelectorAll('tbody tr[data-sector]').forEach((row) => row.classList.toggle('selected', !name ? row.dataset.sector === sectors[0].name : row.dataset.sector === name));
      menu.classList.remove('is-open');
      button.setAttribute('aria-expanded', 'false');
    };
    button.addEventListener('click', (event) => { event.preventDefault(); const open=!menu.classList.contains('is-open'); if (open) { const raw = button.getBoundingClientRect(); const rect = raw.width && raw.height ? raw : root.getBoundingClientRect(); menu.style.left = `${rect.left + 8}px`; menu.style.top = `${rect.top + 44}px`; } menu.classList.toggle('is-open', open); button.setAttribute('aria-expanded', String(open)); });
    menu.addEventListener('click', (event) => { const option=event.target.closest('button[data-sector]'); if (option) select(option.dataset.sector); });
    root.querySelectorAll('.heatMap-container .rect-container').forEach((cell) => cell.addEventListener('click', (event) => { event.preventDefault(); select(cell.dataset.sector); }));
  };
  fetch('data/sector-heatmap.json', {cache:'no-store'}).then((r) => r.ok ? r.json() : Promise.reject()).then(render).catch(()=>{});
})();
