const VERSION = "wata-registry-v15";
const APP_SHELL = [
  "/", "/index.html", "/styles.css?v=31", "/app.js?v=36", "/i18n.js?v=4", "/theme-init.js",
  "/partner-branding.js", "/manifest.webmanifest", "/assets/registry/icon-32.png",
  "/assets/registry/apple-touch-icon.png", "/assets/registry/icon-192.png",
  "/assets/registry/icon-512.png", "/assets/registry/icon-512-maskable.png",
  "/assets/brand/wata-logo.png", "/assets/brand/topography.svg",
  "/assets/vendor/leaflet/leaflet.css", "/assets/vendor/leaflet/leaflet.js"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(key => key !== VERSION).map(key => caches.delete(key))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET") return;
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) {
    if (url.origin === self.location.origin && url.pathname.startsWith("/api/")) {
      event.respondWith(fetch(request).catch(() => new Response(
        JSON.stringify({ error: "Offline: live Registry data is unavailable" }),
        { status: 503, headers: { "content-type": "application/json", "cache-control": "no-store" } }
      )));
    }
    return;
  }
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/index.html")));
    return;
  }
  event.respondWith(fetch(request).then(response => {
    const copy = response.clone();
    caches.open(VERSION).then(cache => cache.put(request, copy));
    return response;
  }).catch(() => caches.match(request)));
});
