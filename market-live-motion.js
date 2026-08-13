/* UMS LIVE verified market-motion layer. It animates only between two sourced snapshot values; it never invents a price movement. */
(() => {
  'use strict';
  const memory = new Map();
  const numberOf = value => {
    const parsed = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  };
  const decimals = value => {
    const match = String(value).replace(/,/g, '').match(/\.(\d+)/);
    return match ? Math.min(match[1].length, 2) : 0;
  };
  const format = (value, template) => new Intl.NumberFormat('en-US', { minimumFractionDigits: decimals(template), maximumFractionDigits: decimals(template) }).format(value);
  const animate = (element, key, finalValue) => {
    if (!element || finalValue === '—') return;
    const target = numberOf(finalValue);
    if (target === null) { element.textContent = finalValue; return; }
    const previous = memory.get(key);
    memory.set(key, target);
    if (previous === undefined || previous === target) { element.textContent = finalValue; return; }
    const start = performance.now();
    const duration = 720;
    element.classList.remove('ums-value-up', 'ums-value-down');
    element.classList.add(target > previous ? 'ums-value-up' : 'ums-value-down');
    const tick = now => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      element.textContent = format(previous + (target - previous) * eased, finalValue);
      if (progress < 1) requestAnimationFrame(tick);
      else { element.textContent = finalValue; window.setTimeout(() => element.classList.remove('ums-value-up', 'ums-value-down'), 1100); }
    };
    requestAnimationFrame(tick);
  };
  window.umsAnimateVerifiedValue = animate;
})();
