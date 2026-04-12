const CACHE_NAME = 'campanest-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  const requestUrl = new URL(event.request.url);
  if (!['http:', 'https:'].includes(requestUrl.protocol)) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        return response;
      }

      return fetch(event.request);
    }).catch(() => {
      // Avoid crashing fetch events for requests that are blocked/offline.
      return new Response('Offline', { status: 503, statusText: 'Offline' });
    })
  );
});
