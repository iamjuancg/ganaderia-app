const CACHE_NAME = 'ganaderia-v18';
const STATIC_ASSETS = [
  './',
  './index.html',
  './css/main.css',
  './js/app.js',
  './js/config.js',
  './js/version.js',
  './js/db/database.js',
  './js/db/seed.js',
  './js/utils/appstate.js',
  './js/utils/date.js',
  './js/utils/dropdown.js',
  './js/utils/format.js',
  './js/utils/gdrive.js',
  './js/utils/toast.js',
  './js/utils/modal.js',
  './js/views/dashboard.js',
  './js/views/animales.js',
  './js/views/eventos.js',
  './js/views/finanzas.js',
  './js/views/informes.js',
  './js/views/ajustes.js',
  './offline.html',
  './manifest.json',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return res;
      }).catch(() => {
        if (e.request.mode === 'navigate') return caches.match('./offline.html');
      });
    })
  );
});
