import { useEffect } from 'react';
import { isNativeApp } from '@/lib/nativeApp';

/**
 * Registers the app's service worker (the FCM worker, which also serves the offline page) once the
 * app is ready, so a later page load without network shows SpotOn's offline page. Push permission
 * is still asked separately (usePushNotifications registers the same worker again, a no-op).
 */
export function useServiceWorker(ready: boolean) {
  useEffect(() => {
    // The Android/iOS app has its own offline page and native push (capacitor.config.ts).
    if (!ready || !('serviceWorker' in navigator) || isNativeApp()) return;
    navigator.serviceWorker.register('/api/firebase-messaging-sw', { scope: '/' }).catch((error) => {
      console.warn('Service worker registration failed:', error);
    });
  }, [ready]);
}
