// Minimal service worker for LegalWings CRM PWA installability.
// The CRM is data-driven and auth-gated, so we deliberately do NOT cache API
// responses or pages (that would risk showing stale leads / cross-user data).
// This SW only satisfies the "installable" requirement and passes requests
// straight through to the network.

const VERSION = 'legalwings-v1';

self.addEventListener('install', (event) => {
  // Activate this SW immediately without waiting for old tabs to close.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Drop any caches from older versions and take control of open pages.
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  // Network pass-through. A fetch handler must exist for the app to be
  // installable on Chromium browsers; we intentionally keep it network-first
  // with no caching so users always see live data.
  event.respondWith(fetch(event.request).catch(() => Response.error()));
});
