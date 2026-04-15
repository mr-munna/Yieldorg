self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  return self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // Simple pass-through fetch
  e.respondWith(fetch(e.request).catch(() => {
    return new Response('Offline mode not fully configured yet.');
  }));
});
