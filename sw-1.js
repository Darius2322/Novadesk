/**
 * NovaDeskOnline Service Worker v2.0
 * Offline-first PWA with push notifications and background sync
 */
const CACHE_VER   = 'nd-v2.0.1';
const SHELL_CACHE = `${CACHE_VER}-shell`;
const CDN_CACHE   = `${CACHE_VER}-cdn`;
const OFFLINE_URL = '/offline.html';

const SHELL_ASSETS = ['/', '/index.html', '/offline.html', '/manifest.json', '/icon-192.png', '/icon-512.png'];

// ── INSTALL ──────────────────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(SHELL_CACHE)
      .then(c => c.addAll(SHELL_ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

// ── ACTIVATE ─────────────────────────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== SHELL_CACHE && k !== CDN_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ── FETCH ────────────────────────────────────────────────────────
self.addEventListener('fetch', e => {
  const { request: req } = e;
  const url = new URL(req.url);

  if (req.method !== 'GET' || !url.protocol.startsWith('http')) return;

  // Supabase — always network, never cache
  if (url.hostname.includes('supabase.co')) {
    e.respondWith(fetch(req).catch(() => new Response(JSON.stringify({error:'offline'}),{status:503,headers:{'Content-Type':'application/json'}})));
    return;
  }

  // Config API — network only
  if (url.pathname === '/api/config') { e.respondWith(fetch(req)); return; }

  // CDN assets — cache first, long TTL
  if (url.hostname.includes('cdnjs.') || url.hostname.includes('fonts.') || url.hostname.includes('cdn.jsdelivr.net')) {
    e.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(r => {
        if (r.ok) caches.open(CDN_CACHE).then(c => c.put(req, r.clone()));
        return r;
      }))
    );
    return;
  }

  // Navigation — network first, fallback to cache then offline
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(r => { if (r.ok) caches.open(SHELL_CACHE).then(c => c.put(req, r.clone())); return r; })
        .catch(() => caches.match(req).then(c => c || caches.match(OFFLINE_URL)))
    );
    return;
  }

  // Everything else — stale-while-revalidate
  e.respondWith(
    caches.match(req).then(cached => {
      const net = fetch(req).then(r => { if (r.ok) caches.open(SHELL_CACHE).then(c => c.put(req, r.clone())); return r; });
      return cached || net;
    })
  );
});

// ── PUSH NOTIFICATIONS ───────────────────────────────────────────
self.addEventListener('push', e => {
  let d = { title: 'NovaDeskOnline', body: 'You have a new update.' };
  try { d = e.data.json(); } catch(_) {}
  e.waitUntil(self.registration.showNotification(d.title || 'NovaDeskOnline', {
    body: d.body, icon: '/icon-192.png', badge: '/icon-192.png',
    tag: d.tag || 'nd', renotify: true, vibrate: [100,50,100],
    data: { url: d.url || '/' },
    actions: [{ action:'view', title:'View' }, { action:'dismiss', title:'Dismiss' }]
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  if (e.action === 'dismiss') return;
  const url = e.notification.data?.url || '/';
  e.waitUntil(
    clients.matchAll({ type:'window', includeUncontrolled:true }).then(list => {
      for (const c of list) { if (c.url.includes(self.location.origin) && 'focus' in c) return c.focus(); }
      return clients.openWindow(url);
    })
  );
});

// ── BACKGROUND SYNC ──────────────────────────────────────────────
self.addEventListener('sync', e => {
  if (e.tag === 'sync-requests') e.waitUntil(notifyClients('sync-check', {}));
});

self.addEventListener('periodicsync', e => {
  if (e.tag === 'check-request-status') e.waitUntil(notifyClients('check-updates', {}));
});

// ── MESSAGES ─────────────────────────────────────────────────────
self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

async function notifyClients(type, data) {
  const all = await clients.matchAll({ type:'window' });
  all.forEach(c => c.postMessage({ type, ...data }));
}
