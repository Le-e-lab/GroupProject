const CACHE_NAME = 'upath-cache-v4';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/dashboard.html',
  '/lecturer_dashboard.html',
  '/css/theme.css',
  '/css/toast.css',
  '/js/api.js',
  '/js/toast.js',
  '/js/layout.js'
];

// Install Event - Cache Core Assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching App Shell');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate Event - Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event - Serve from Network first, fallback to Cache
self.addEventListener('fetch', (event) => {
  // Only cache GET requests, ignore APIs (which are marked with /api/) and chrome-extension://
  if (event.request.method !== 'GET' || event.request.url.includes('/api/') || !event.request.url.startsWith('http')) {
    return;
  }

  // Use Network-First Strategy 
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // We received a valid network response, so let's cache it and return it
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Network failed (offline), try the cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // If we don't have it in cache either
          console.warn('[Service Worker] Offline and resource not cached:', event.request.url);
        });
      })
  );
});
