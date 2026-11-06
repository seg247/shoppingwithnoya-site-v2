/* Opt-in future QA only. No cookies, storage, IP classification or collection exclusion. */
(() => {
  'use strict';
  const values = new URL(window.location.href).searchParams.getAll('noya_test');
  if (values.length !== 1 || !/^[A-Za-z0-9_-]{1,64}$/.test(values[0])) return;
  const marker = values[0];
  window.dataLayer = window.dataLayer || [];
  function label() { window.dataLayer.push(arguments); }
  // Runs before each page's existing GA config. page_location already contains the marker.
  label('set', { noya_test: marker });
  function destination(raw) {
    if (!raw || raw.startsWith('#')) return null;
    try {
      const url = new URL(raw, window.location.href);
      if (url.origin !== window.location.origin || !/^https?:$/.test(url.protocol)
          || /\.[a-z0-9]+$/i.test(url.pathname.replace(/\/$/, ''))) return null;
      url.searchParams.set('noya_test', marker);
      return url;
    } catch { return null; }
  }
  function mark() {
    if (typeof document === 'undefined' || !document.body) return;
    for (const a of document.querySelectorAll('a[href]:not([download])')) {
      const url = destination(a.getAttribute('href'));
      if (url && a.href !== url.href) a.href = url.href;
    }
    for (const form of document.querySelectorAll('form')) {
      if (form.method.toLowerCase() !== 'get' || !destination(form.getAttribute('action') || window.location.href)) continue;
      let input = form.querySelector('input[name="noya_test"]');
      if (!input) {
        input = document.createElement('input'); input.type = 'hidden'; input.name = 'noya_test'; form.append(input);
      }
      if (input.value !== marker) input.value = marker;
    }
  }
  function start() {
    mark();
    // Hydrated cards/navigation receive the same marker; affiliate destinations never change.
    new MutationObserver(mark).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['href', 'action'] });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
