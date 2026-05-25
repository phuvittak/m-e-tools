/* M.E.Tools service worker — offline app shell + runtime cache.
   Scope = the folder this file lives in (the app root). */
var CACHE = "metools-v1";
var CORE = [
  "./", "index.html", "shop.html", "product.html", "cart.html", "orders.html",
  "login.html", "register.html", "manifest.webmanifest",
  "assets/base.css", "assets/app.css", "assets/admin.css",
  "assets/store.js", "assets/thai-geo.js", "assets/ui.js", "assets/public.js", "assets/admin.js",
  "assets/icon.svg", "assets/mascot-on-yellow.png",
];

self.addEventListener("install", function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function (c) {
    // cache individually so one failure doesn't abort the whole install
    return Promise.all(CORE.map(function (u) { return c.add(u).catch(function () {}); }));
  }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  // let cross-origin (e.g. jsdelivr address dataset) go straight to network
  if (url.origin !== self.location.origin) return;
  if (req.mode === "navigate") {
    // network-first for pages, fall back to cache/offline
    e.respondWith(
      fetch(req).then(function (res) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); return res; })
        .catch(function () { return caches.match(req).then(function (m) { return m || caches.match("index.html"); }); })
    );
    return;
  }
  // cache-first for static assets
  e.respondWith(
    caches.match(req).then(function (cached) {
      return cached || fetch(req).then(function (res) {
        var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); return res;
      }).catch(function () { return cached; });
    })
  );
});
