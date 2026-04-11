const CACHE = 'qlog-tools-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/css/style.css',
  '/assets/css/mdesign.css',
  '/assets/fonts/fonts.css',
  '/assets/fonts/roboto-latin.woff2',
  '/assets/fonts/roboto-latin-ext.woff2',
  '/assets/fonts/material-symbols-outlined.woff2',
  '/assets/js/mdesign.js',
  '/assets/js/app.js',
  '/assets/js/modules/api.js',
  '/assets/js/modules/nav.js',
  '/assets/js/modules/dashboard.js',
  '/assets/js/modules/qsl.js',
  '/assets/js/modules/settings.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // API-Calls niemals cachen
  if (e.request.url.includes('/api/')) return;

  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
