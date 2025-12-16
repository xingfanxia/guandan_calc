// Service Worker for Guandan Calculator PWA
// Provides offline support and fast loading

const CACHE_NAME = 'guandan-calc-v10.1';
const RUNTIME_CACHE = 'guandan-runtime-v10.1';

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/players.html',
  '/player-profile.html',
  '/rooms.html',
  '/manifest.json'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting()) // Activate immediately
  );
});

// Activate event - cleanup old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // Take control immediately
  );
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // API requests: network only (always fresh data)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(request));
    return;
  }

  // Static assets: network first, fallback to cache
  event.respondWith(
    fetch(request)
      .then(response => {
        // Clone response before caching
        const responseClone = response.clone();

        // Update runtime cache
        caches.open(RUNTIME_CACHE).then(cache => {
          cache.put(request, responseClone);
        });

        return response;
      })
      .catch(() => {
        // Network failed, try cache
        return caches.match(request).then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }

          // Offline fallback
          if (request.mode === 'navigate') {
            return caches.match('/index.html');
          }

          return new Response('Offline', { status: 503 });
        });
      })
  );
});
