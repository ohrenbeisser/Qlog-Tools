/**
 * sw.js — Service Worker für Qlog-Tools PWA.
 *
 * Strategie: Cache-First für alle statischen Assets, Network-Only für /api/.
 *
 * Cache-Versionierung: CACHE_NAME ändern, um beim nächsten Aktivieren
 * alle alten Caches zu löschen (z. B. nach einem Deployment).
 */

const CACHE_NAME = 'qlog-tools-v2';

/** Alle statischen Dateien, die beim Install gecacht werden. */
const STATIC_ASSETS = [
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
  '/assets/js/modules/qsl_export.js',
  '/assets/js/modules/settings.js',
];

/**
 * Install: Alle Assets in den Cache laden.
 * skipWaiting() aktiviert den neuen SW sofort (ohne auf Tab-Schliessen zu warten).
 */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

/**
 * Activate: Alte Cache-Versionen löschen.
 * clients.claim() übernimmt sofort die Kontrolle über alle offenen Tabs.
 */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

/**
 * Fetch: Cache-First für Assets, Network-Only für API-Calls.
 *
 * API-Calls (/api/) werden nie gecacht, da sie dynamische Daten liefern.
 * Alle anderen Requests werden aus dem Cache beantwortet (Offline-Fähigkeit).
 */
self.addEventListener('fetch', event => {
  // API-Calls immer direkt ans Netzwerk durchleiten
  if (event.request.url.includes('/api/')) return;

  event.respondWith(
    caches.match(event.request)
      .then(cached => cached || fetch(event.request))
  );
});
