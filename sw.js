const CACHE = "eulen-v14";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css?v=14",
  "./manifest.webmanifest",
  "./assets/icon.svg",
  "./src/app.js?v=14",
  "./src/core.js?v=14",
  "./src/data.js?v=14",
  "./src/providers.js?v=14",
  "./src/sync.js?v=14"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== location.origin) return;
  event.respondWith(fetch(event.request)
    .then(response => {
      const copy = response.clone();
      caches.open(CACHE).then(cache => cache.put(event.request, copy));
      return response;
    })
    .catch(() => caches.match(event.request).then(cached => cached ?? caches.match("./index.html"))));
});
