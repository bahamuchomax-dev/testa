var VERSION = 'oriex-next-v0.3.0';
var CORE = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(CORE); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  var url = new URL(e.request.url);
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).then(function (r) {
      var cp = r.clone(); caches.open(VERSION).then(function (c) { c.put('./index.html', cp); }); return r;
    }).catch(function () { return caches.match('./index.html'); }));
    return;
  }
  if (url.origin === location.origin) {
    e.respondWith(caches.match(e.request).then(function (hit) {
      return hit || fetch(e.request).then(function (r) {
        var cp = r.clone(); caches.open(VERSION).then(function (c) { c.put(e.request, cp); }); return r;
      });
    }));
  }
});
