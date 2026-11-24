// Jewel Cascade service worker: makes the game load instantly and work offline.
// Bump VERSION whenever you change any file in SHELL so phones pick up the update.
const VERSION = 'v2';
const CACHE = `jewel-cascade-${VERSION}`;
const FONT_CACHE = 'jewel-cascade-fonts';
const SHELL = [
  './',
  'css/styles.css',
  'js/engine.js',
  'js/gems.js',
  'js/game.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/maskable-192.png',
  'icons/maskable-512.png',
  'icons/apple-touch-icon.png',
  'icons/favicon-32.png',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== FONT_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Google Fonts: cache-first, so the lettering still shows offline once loaded.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.open(FONT_CACHE).then(async cache => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
        return res;
      })
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Same-origin: serve from cache straight away, refresh the cache in the background.
  event.respondWith(
    caches.open(CACHE).then(async cache => {
      const key = req.mode === 'navigate' ? './' : req;
      const hit = await cache.match(key, { ignoreSearch: req.mode === 'navigate' });
      const refresh = fetch(req)
        .then(res => { if (res.ok) cache.put(key, res.clone()); return res; })
        .catch(() => hit);
      if (hit) { event.waitUntil(refresh.catch(() => {})); return hit; }
      return refresh;
    })
  );
});
