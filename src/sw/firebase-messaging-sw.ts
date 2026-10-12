// The FCM service worker, on the modular Firebase SDK (bundled by scripts/build-sw.mjs; the
// /api/firebase-messaging-sw route serves it with the Firebase config in front of it).
// A message with a notification payload (what our functions send) is shown by the SDK itself.
// It also serves the offline page (below); the app registers it on every load (useServiceWorker).
import { initializeApp, type FirebaseOptions } from 'firebase/app';
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw';
import { OFFLINE_CSP, offlineHtml } from '../lib/offlinePage';

declare const self: ServiceWorkerGlobalScope & { FIREBASE_CONFIG: FirebaseOptions };

const messaging = getMessaging(initializeApp(self.FIREBASE_CONFIG));

onBackgroundMessage(messaging, (payload) => {
  // Shown already by the SDK; showing it here as well made every push arrive twice.
  if (payload.notification) return;
  return self.registration.showNotification(payload.data?.title || 'SpotOn', {
    body: payload.data?.body || '',
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    tag: payload.data?.tag || 'spoton-notification',
    data: payload.data,
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) return client.focus();
      }
      return self.clients.openWindow('/');
    }),
  );
});

// Offline: a failed page load (no network) shows SpotOn's own offline page instead of the
// browser's error page. Only navigations; every other request goes to the network untouched.
const OFFLINE_CACHE = 'spoton-offline-v1';

self.addEventListener('install', (event) => {
  // The icon the offline page shows; the page itself is generated here.
  event.waitUntil(caches.open(OFFLINE_CACHE).then((cache) => cache.add('/icon-192x192.png')).catch(() => undefined));
  void self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => new Response(offlineHtml(self.navigator.language), {
        status: 503,
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': OFFLINE_CSP },
      })),
    );
    return;
  }
  // The offline page's icon, from the cache when the network is gone.
  if (new URL(request.url).pathname === '/icon-192x192.png') {
    event.respondWith(fetch(request).catch(() => caches.match(request).then((r) => r ?? Response.error())));
  }
});
