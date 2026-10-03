// This device's push registration: FCM targets an app instance by its Firebase Installation ID
// (FID), delivered by onRegistered after register() (the token API, getToken/deleteToken, is
// deprecated). The FID is kept in users/{uid}.fcmFids and remembered locally, so sign-out can
// remove it (SEC-14). Devices registered before v2.1.0 left a token in users/{uid}.fcmTokens: it is
// removed when the device registers its FID (until then the server still sends to it).
import { arrayRemove, arrayUnion, doc, updateDoc } from 'firebase/firestore';
import { getMessaging, isSupported, onRegistered, register, unregister, type Messaging } from 'firebase/messaging';
import { app, db } from '@/lib/firebase';

const FID_KEY = 'spoton-fcm-fid';
/** Before v2.1.0: the device's FCM registration token. */
const LEGACY_TOKEN_KEY = 'spoton-fcm-token';
const REGISTER_TIMEOUT_MS = 20_000;

function read(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) globalThis.localStorage?.removeItem(key);
    else globalThis.localStorage?.setItem(key, value);
  } catch {
    // storage unavailable: sign-out then cannot remove this device's entry (the server prunes it)
  }
}

export const rememberedFid = () => read(FID_KEY);
export const rememberedLegacyToken = () => read(LEGACY_TOKEN_KEY);

/** Registers this device with FCM and resolves with its FID (from onRegistered). */
export function registerDevice(messaging: Messaging, options: { vapidKey: string; serviceWorkerRegistration: ServiceWorkerRegistration }): Promise<string> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (run: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      unsubscribe();
      run();
    };
    const timer = setTimeout(() => finish(() => reject(new Error('FCM_REGISTER_TIMEOUT'))), REGISTER_TIMEOUT_MS);
    const unsubscribe = onRegistered(messaging, (fid) => finish(() => resolve(fid)));
    register(messaging, options).catch((error: unknown) => finish(() => reject(error)));
  });
}

/**
 * Stores this device's FID on the user (and drops the device's earlier FID and legacy token),
 * with the extra user fields the caller passes (language, the notification switch).
 */
export async function saveDeviceFid(uid: string, fid: string, extra: Record<string, unknown> = {}): Promise<void> {
  const ref = doc(db, 'users', uid);
  const previous = rememberedFid();
  const legacy = rememberedLegacyToken();
  await updateDoc(ref, { fcmFids: arrayUnion(fid), ...(legacy ? { fcmTokens: arrayRemove(legacy) } : {}), ...extra });
  // A field takes one array transform per write: the old FID goes in a second one.
  if (previous && previous !== fid) await updateDoc(ref, { fcmFids: arrayRemove(previous) });
  write(FID_KEY, fid);
  write(LEGACY_TOKEN_KEY, null);
}

/**
 * Sign-out and account deletion: removes this device's FID (and a legacy token) from the user,
 * then unregisters the device from FCM. Never prompts; failures are logged.
 */
export async function forgetDevice(uid: string | null): Promise<void> {
  const fid = rememberedFid();
  const legacy = rememberedLegacyToken();
  if (uid && (fid || legacy)) {
    try {
      await updateDoc(doc(db, 'users', uid), {
        ...(fid ? { fcmFids: arrayRemove(fid) } : {}),
        ...(legacy ? { fcmTokens: arrayRemove(legacy) } : {}),
      });
    } catch (error) {
      console.error('Failed to remove the push registration:', error);
    }
  }
  write(FID_KEY, null);
  write(LEGACY_TOKEN_KEY, null);
  if (!fid) return;
  try {
    if (await isSupported()) await unregister(getMessaging(app));
  } catch (error) {
    console.error('Failed to unregister from FCM:', error);
  }
}
