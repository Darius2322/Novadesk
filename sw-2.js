// sw.js — NovaDeskOnline Service Worker
//
// DEPLOYMENT: this file must sit at the ROOT of your site, next to
// index.html (e.g. https://novadesk-self.vercel.app/sw.js), because
// navigator.serviceWorker.register('/sw.js', {scope:'/'}) in the app
// expects it there. If you're on Vercel, just drop this file in the
// same folder you deploy index.html from.
//
// WHY THIS FIXES "This site can't be reached" WHEN OFFLINE:
// Without a service worker actually caching the app shell, the browser
// has nothing to show when there's no network — hence the native
// ERR_FAILED error page you saw. This worker caches index.html (and a
// few other assets) on first visit, then serves that cached copy
// whenever the network is unavailable, so the installed PWA always
// opens to something instead of a browser error.

const CACHE_VERSION = 'novadesk-v1';
const APP_SHELL = [
  '/',
  '/index.html',
];

// ── INSTALL: cache the app shell up front ──────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// ── ACTIVATE: drop old cache versions ────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── FETCH: network-first for navigation (so users get the latest
//    version when online), falling back to cache when offline ───────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const isNavigation = request.mode === 'navigate';

  if (isNavigation) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Keep the cached shell fresh with whatever we just fetched
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put('/index.html', copy));
          return response;
        })
        .catch(() =>
          caches.match('/index.html').then((cached) => cached || caches.match('/'))
        )
    );
    return;
  }

  // Other same-origin GET requests: try cache first (fast + works
  // offline), fall back to network, and cache whatever we fetch
  if (new URL(request.url).origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          return response;
        }).catch(() => cached);
      })
    );
  }
});

// ── Simple push-notification click handling (optional, used if you
//    later add web push — safe no-op otherwise) ─────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientList) => {
      if (clientList.length > 0) {
        clientList[0].postMessage({ type: 'navigate' });
        return clientList[0].focus();
      }
      return self.clients.openWindow('/');
    })
  );
});
