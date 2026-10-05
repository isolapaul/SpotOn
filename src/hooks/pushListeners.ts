// The push listeners shared by every usePushNotifications instance (module-level singletons): token
// changes are stored for whoever is signed in then, and messages that arrive in the foreground go to
// the notification centre. Browsers use the web FCM SDK; the Android/iOS app the native one.
import { onMessage, onRegistered, type Messaging } from 'firebase/messaging';
import { useUserStore } from '@/store/useUserStore';
import { useLanguageStore } from '@/store/useLanguageStore';
import { useNotificationStore, type Notification as AppNotification } from '@/store/useNotificationStore';
import { translate } from '@/lib/i18n';
import { rememberedFid, saveDeviceFid } from '@/store/pushDevice';
import { listenNativePush, saveNativeToken, type NativePushMessage } from '@/store/nativePush';

// Singleton: Module-level variable to track foreground listener
// This ensures only ONE listener is active across all hook instances
let listenerSetup = false;

// The Android/iOS app's listeners (native FCM, store/nativePush.ts) - SINGLETON like the web one.
let nativeListenerSetup = false;

/** A foreground message into the notification centre (the server inbox covers moderation news). */
function addForegroundMessage(message: { title?: string; body?: string; data?: Record<string, string> }) {
  // Moderation decisions also land in the server inbox (item 4), which the centre shows already.
  if (message.data?.inbox === '1') return;
  // Read the language at message time: this listener is registered once (no stale closure).
  const title = message.title || translate(useLanguageStore.getState().language ?? 'hu', 'newNotification');
  const body = message.body || '';
  // Add to notification center only (no toast to avoid stacking)
  const notificationType = message.data?.type || 'general';
  // Use the store directly to avoid stale closure issues
  useNotificationStore.getState().addNotification({
    title,
    body,
    // The server sends only known kinds; the value is passed through unchecked, as before.
    type: notificationType as AppNotification['type'],
  });
}

export function setupNativeListener() {
  if (nativeListenerSetup) return;
  nativeListenerSetup = true;
  listenNativePush({
    // FCM may issue a new token later: store it for whoever is signed in then.
    onToken: (token) => {
      const uid = useUserStore.getState().user?.uid;
      if (!uid) return;
      saveNativeToken(uid, token).catch((error) => console.error('Failed to store the new FCM token:', error));
    },
    onMessage: (message: NativePushMessage) => addForegroundMessage(message),
  }).catch((error) => {
    nativeListenerSetup = false;
    console.error('Native push listeners failed:', error);
  });
}

// Setup foreground message listener (when app is open) - SINGLETON
export function setupForegroundListener(messaging: Messaging) {
  // Prevent duplicate listeners
  if (listenerSetup) return;
  
  listenerSetup = true;

  // FCM may issue a new FID later (routine syncs): store it for whoever is signed in then.
  onRegistered(messaging, (fid) => {
    const uid = useUserStore.getState().user?.uid;
    if (!uid || fid === rememberedFid()) return;
    saveDeviceFid(uid, fid).catch((error) => console.error('Failed to store the new FCM registration:', error));
  });
  
  onMessage(messaging, (payload) => {
    addForegroundMessage({ title: payload.notification?.title, body: payload.notification?.body, data: payload.data });

    // Do NOT show a native browser Notification here to avoid duplicates
    // (the service worker will display notifications when the app is backgrounded,
    // and in-foreground we add items to the in-app NotificationCenter instead).
  });
}
