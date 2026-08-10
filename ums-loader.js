/* UMS LIVE opening screen: intentional 3.5 second branded loading interval. */
(() => {
  const loader = document.querySelector('.ums-opening-screen');
  if (!loader) return;
  window.setTimeout(() => {
    loader.classList.add('is-done');
    window.setTimeout(() => loader.remove(), 300);
  }, 3500);
})();
