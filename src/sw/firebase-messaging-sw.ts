// The FCM service worker, on the modular Firebase SDK (bundled by scripts/build-sw.mjs; the
// /api/firebase-messaging-sw route serves it with the Firebase config in front of it).
// A message with a notification payload (what our functions send) is shown by the SDK itself.
import { initializeApp, type FirebaseOptions } from 'firebase/app';
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw';

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
