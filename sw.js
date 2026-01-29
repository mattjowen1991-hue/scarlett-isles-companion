const CACHE_NAME = 'knightly-treasures-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/items.json',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/shop-logo.png'
];

// Install event - cache assets
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching files');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => {
        console.log('Service Worker: All files cached');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Service Worker: Cache failed', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('Service Worker: Clearing old cache', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker: Now active');
      return self.clients.claim();
    })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  // Skip Firebase and external API requests (always go to network)
  const url = new URL(event.request.url);
  if (url.hostname.includes('firebase') || 
      url.hostname.includes('gstatic') ||
      url.hostname.includes('iconify')) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        // Return cached version or fetch from network
        if (cachedResponse) {
          // Fetch updated version in background
          fetch(event.request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse);
              });
            }
          }).catch(() => {});
          
          return cachedResponse;
        }
        
        // Not in cache, fetch from network
        return fetch(event.request)
          .then((networkResponse) => {
            // Cache the new response
            if (networkResponse && networkResponse.status === 200) {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseToCache);
              });
            }
            return networkResponse;
          })
          .catch(() => {
            // Offline fallback for HTML pages
            if (event.request.headers.get('accept').includes('text/html')) {
              return caches.match('/index.html');
            }
          });
      })
  );
});
