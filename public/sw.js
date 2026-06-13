/* Oriex service worker — offline app shell.
   Strategy:
   - navigations (HTML): network-first, fall back to cached app when offline
   - Google Fonts: stale-while-revalidate (works offline after first load)
   - same-origin GET (manifest, etc.): stale-while-revalidate
   - everything else (Firestore/Firebase/Google APIs): not intercepted -> normal network
*/
var VERSION = 'v7.36-hamspawn';
var SHELL = 'oriex-shell-' + VERSION;
var FONTS = 'oriex-fonts-v1';
var SHELL_URLS = ['./', './index.html', './manifest.webmanifest', './three.min.js', './icon-180.png', './icon-192.png', './icon-512.png'];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(SHELL).then(function (c) {
      return Promise.all(SHELL_URLS.map(function (u) {
        return fetch(u, { cache: 'no-cache' })
          .then(function (r) { if (r && r.ok) return c.put(u, r.clone()); })
          .catch(function () {});
      }));
    })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== SHELL && k !== FONTS) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

function swr(cacheName, req) {
  return caches.open(cacheName).then(function (c) {
    return c.match(req).then(function (cached) {
      var net = fetch(req).then(function (res) {
        if (res && res.status === 200) c.put(req, res.clone());
        return res;
      }).catch(function () { return cached; });
      return cached || net;
    });
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url;
  try { url = new URL(req.url); } catch (_) { return; }

  // App navigations: network-first, offline -> cached shell
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(SHELL).then(function (c) { c.put('./', copy); });
        }
        return res;
      }).catch(function () {
        return caches.match('./').then(function (r) {
          return r || caches.match('./index.html');
        });
      })
    );
    return;
  }

  // Google Fonts: stale-while-revalidate
  if (url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com') {
    e.respondWith(swr(FONTS, req));
    return;
  }

  // Same-origin static assets: stale-while-revalidate
  if (url.origin === self.location.origin) {
    e.respondWith(swr(SHELL, req));
    return;
  }

  // else: Firestore / Firebase / other APIs -> let the network handle it
});
