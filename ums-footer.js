/* UMS LIVE footer adapter: retain Yahoo's footer structure while replacing irrelevant finance, social, and Yahoo destinations. */
(() => {
  const footer = document.querySelector('section[data-testid="footer"]');
  if (!footer) return;
  const makeLink = (label, href) => {
    const link = document.createElement('a');
    link.className = 'subtle-link fin-size-medium yf-119g04z';
    link.href = href;
    link.textContent = label;
    return link;
  };
  const fillColumn = (selector, title, items) => {
    const column = footer.querySelector(selector);
    if (!column) return;
    column.replaceChildren();
    const heading = document.createElement('div');
    heading.className = 'colHeading font-condensed yf-1gzeyu1';
    heading.textContent = title;
    column.appendChild(heading);
    items.forEach(([label, href]) => column.appendChild(makeLink(label, href)));
  };
  footer.querySelector('.social-links')?.remove();
  footer.querySelector('.privacy-container')?.remove();
  const copyright = footer.querySelector('.copyright-wrapper div');
  if (copyright) copyright.textContent = '© 2026 The Cambreth Organization. All rights reserved.';
  fillColumn('.trending', 'Mineral Focus', [
    ['Lithium Carbonate', '#/market/lithium'],
    ['Cobalt & Copper', '#/market/cobalt'],
    ['Graphite & Anodes', '#/market/graphite'],
    ['Rare Earths', '#/market/rare-earths'],
    ['Construction Aggregates', '#/market/aggregates']
  ]);
  fillColumn('.explore-more', 'Research Tools', [
    ['Market Snapshot', '#/market'],
    ['Regional Exposure', '#/markets'],
    ['Supply Chain Signals', '#/research'],
    ['Construction Materials', '#/market/aggregates'],
    ['Source Method', '#/methodology']
  ]);
  fillColumn('.about', 'About UMS LIVE', [
    ['Research Methodology', '#/methodology'],
    ['Data Standards', '#/standards'],
    ['The Cambreth Organization', '#/about']
  ]);
})();
