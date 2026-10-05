// Push notifications inside the Android/iOS app. A WebView has no Web Push, so the native FCM SDK
// (@capacitor-firebase/messaging) registers the device and yields an FCM registration token. It is
// kept in users/{uid}.fcmTokens, which the server sends to with the token API (functions/src/lib/
// notify.ts) next to the browsers' FIDs in fcmFids, and remembered locally under its own key, so
// sign-out removes it (SEC-14) and the browser code (pushDevice.ts) never touches it.
import { arrayRemove, arrayUnion, doc, updateDoc } from 'firebase/firestore';
import type { PluginListenerHandle } from '@capacitor/core';
import { db } from '@/lib/firebase';

const TOKEN_KEY = 'spoton-native-fcm-token';

export type NativePushPermission = 'granted' | 'denied' | 'prompt';

function read(): string | null {
  try {
    return globalThis.localStorage?.getItem(TOKEN_KEY) ?? null;
  } catch {
    return null;
  }
}

function write(value: string | null) {
  try {
    if (value === null) globalThis.localStorage?.removeItem(TOKEN_KEY);
    else globalThis.localStorage?.setItem(TOKEN_KEY, value);
  } catch {
    // storage unavailable: sign-out then cannot remove this device's token (the server prunes dead ones)
  }
}

const plugin = async () => (await import('@capacitor-firebase/messaging')).FirebaseMessaging;

/** The app's notification permission ('prompt' also covers Android's "ask again"). */
export async function nativePushPermission(): Promise<NativePushPermission> {
  const { receive } = await (await plugin()).checkPermissions();
  return receive === 'granted' ? 'granted' : receive === 'denied' ? 'denied' : 'prompt';
}

/** Shows the system permission dialog (when it may still be shown); true when granted. */
export async function requestNativePushPermission(): Promise<boolean> {
  const { receive } = await (await plugin()).requestPermissions();
  return receive === 'granted';
}

/** This device's FCM registration token. */
export async function nativePushToken(): Promise<string> {
  const { token } = await (await plugin()).getToken();
  return token;
}

/** Stores the token on the user (dropping this device's earlier token), with the caller's extra fields. */
export async function saveNativeToken(uid: string, token: string, extra: Record<string, unknown> = {}): Promise<void> {
  const ref = doc(db, 'users', uid);
  const previous = read();
  await updateDoc(ref, { fcmTokens: arrayUnion(token), ...extra });
  // A field takes one array transform per write: the old token goes in a second one.
  if (previous && previous !== token) await updateDoc(ref, { fcmTokens: arrayRemove(previous) });
  write(token);
}

/** Sign-out and account deletion: removes this device's token from the user and from FCM. */
export async function forgetNativeDevice(uid: string | null): Promise<void> {
  const token = read();
  if (!token) return;
  if (uid) {
    try {
      await updateDoc(doc(db, 'users', uid), { fcmTokens: arrayRemove(token) });
    } catch (error) {
      console.error('Failed to remove the push registration:', error);
    }
  }
  write(null);
  try {
    await (await plugin()).deleteToken();
  } catch (error) {
    console.error('Failed to delete the FCM token:', error);
  }
}

export interface NativePushMessage {
  title?: string;
  body?: string;
  data?: Record<string, string>;
}

/**
 * Listens for token changes (stored for whoever is signed in then) and for messages that arrive while
 * the app is in the foreground (the system shows none then; the notification centre does).
 */
export async function listenNativePush(handlers: {
  onToken: (token: string) => void;
  onMessage: (message: NativePushMessage) => void;
}): Promise<PluginListenerHandle[]> {
  const messaging = await plugin();
  return Promise.all([
    messaging.addListener('tokenReceived', ({ token }) => {
      if (token !== read()) handlers.onToken(token);
    }),
    messaging.addListener('notificationReceived', ({ notification }) => {
      handlers.onMessage({
        title: notification.title,
        body: notification.body,
        data: notification.data as Record<string, string> | undefined,
      });
    }),
  ]);
}
