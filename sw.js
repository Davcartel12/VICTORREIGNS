// VictorReigns — Service Worker
const CACHE_NAME = 'vr-cache-v2';

// App shell only. Firebase data always stays live.
const STATIC_ASSETS = [
  '/admin.html',
  '/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .catch(() => {/* a missing asset shouldn't block install */})
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const req = event.request;

  // Only ever handle GETs.
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (e) { return; }

  // Leave everything that isn't our own origin alone — third-party requests
  // (Google, Firebase, CDNs, analytics) must go straight to the network.
  if (url.origin !== self.location.origin) return;

  // Never intercept Firebase / API traffic.
  if (/firebase|firestore|googleapis|gstatic/i.test(url.href)) return;

  event.respondWith(
    fetch(req)
      .then(res => {
        // Cache good responses for offline use
        if (res && res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(async () => {
        // Offline: serve from cache if we have it…
        const hit = await caches.match(req);
        if (hit) return hit;

        // …for page navigations, fall back to the app shell…
        if (req.mode === 'navigate') {
          const shell = await caches.match('/index.html') || await caches.match('/admin.html');
          if (shell) return shell;
        }

        // …otherwise ALWAYS return a real Response.
        // (Returning undefined here is what caused
        //  "Failed to convert value to 'Response'".)
        return new Response('', {
          status: 504,
          statusText: 'Offline',
          headers: { 'Content-Type': 'text/plain' }
        });
      })
  );
});
