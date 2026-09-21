const CACHE = "bizos-pos-shell-v1";
const OFFLINE_FILES = ["/pos-offline.html", "/icons/bizos.svg", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(OFFLINE_FILES)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (event.request.mode === "navigate" && url.pathname.startsWith("/ventas/pos")) {
    event.respondWith(fetch(event.request).catch(() => caches.match("/pos-offline.html")));
    return;
  }
  if (url.origin === self.location.origin && OFFLINE_FILES.includes(url.pathname)) {
    event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
  }
});
