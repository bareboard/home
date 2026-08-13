/* Market-page cleanup: remove every cloned advertising/placeholder slot, including slots inserted late by clone scripts. */
(() => {
  const selectors = '#sda-E2E, [data-ad-config="large-placeholder-e2e"], main [data-testid="ad-container"], main .native-ad, main .sdaContainer, main [id^="sda-"]';
  const clear = () => document.querySelectorAll(selectors).forEach(slot => slot.remove());
  const style = document.createElement('style');
  style.textContent = '#sda-E2E,[data-ad-config="large-placeholder-e2e"]{display:none!important;height:0!important;min-height:0!important;margin:0!important;padding:0!important;visibility:hidden!important}';
  document.head.appendChild(style);
  clear();
  new MutationObserver(clear).observe(document.documentElement,{childList:true,subtree:true});
})();
