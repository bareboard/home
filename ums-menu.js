/* UMS LIVE site menu: one market destination. */
(() => {
  const button = document.querySelector('#_yb_sidenav-btn');
  const header = document.querySelector('header.hideOnPrint.yf-w91b48');
  if (!button || !header) return;
  button.setAttribute('aria-label', 'Open UMS LIVE menu');
  button.setAttribute('aria-expanded', 'false');
  const menu = document.createElement('nav');
  menu.className = 'ums-market-menu';
  menu.setAttribute('aria-label', 'UMS LIVE menu');
  menu.innerHTML = '<a href="markets.html">Market</a>';
  header.appendChild(menu);
  const close = () => { menu.classList.remove('is-open'); button.setAttribute('aria-expanded', 'false'); };
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    const open = !menu.classList.contains('is-open');
    menu.classList.toggle('is-open', open);
    button.setAttribute('aria-expanded', String(open));
  }, true);
  document.addEventListener('click', (event) => { if (!header.contains(event.target)) close(); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') close(); });
})();
