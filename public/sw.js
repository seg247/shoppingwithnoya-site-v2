// sw.js — Shopping With Noya Service Worker
//
// v2. Two fixes over v1:
//
//   1. BASE was '/shoppingwithnoya-site-v2', a GitHub Pages project path. The
//      site is served from the custom domain deals.shoppingwithnoya.com, so
//      every shell asset path was wrong and install-time caching silently
//      failed on the wrong URLs.
//
//   2. site-data.json was cached at all. The strategy was network-first, but
//      writing every response into the cache means any hiccup falls back to
//      arbitrarily old deals — and the homepage's fetch is what OVERWRITES the
//      fresh server-rendered cards. Deal data is the one thing on this site
//      that must never come from a cache, so it now bypasses the SW entirely.
//
// Bumping CACHE_NAME evicts every v1 entry on activate, which is what clears
// the stale deals already sitting in returning visitors' browsers.
const CACHE_NAME = 'noya-v2';

const SHELL_ASSETS = ['/', '/manifest.json', '/favicon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE_NAME)
      // individual failures must not abort the whole install
      .then((cache) => Promise.allSettled(SHELL_ASSETS.map((a) => cache.add(a))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  if (e.request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;

  // Deal data: never touch the cache. Let it go straight to the network so the
  // page can never render deals older than the last export.
  if (url.pathname.includes('site-data.json') || url.pathname.includes('blog-data.json')) {
    return;
  }

  // HTML documents: network-first so a new deploy is picked up immediately,
  // cache only as an offline fallback.
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(e.request).then((c) => c || caches.match('/')))
    );
    return;
  }

  // Fonts: cache-first, they are immutable.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      caches.match(e.request).then(
        (cached) =>
          cached ||
          fetch(e.request).then((res) => {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(e.request, clone));
            return res;
          })
      )
    );
    return;
  }

  // Everything else: network-first, cache fallback.
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
