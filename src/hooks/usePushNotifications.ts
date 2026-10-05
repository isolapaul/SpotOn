import { useEffect, useState } from 'react';
import { getMessaging, isSupported } from 'firebase/messaging';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db, app } from '@/lib/firebase';
import { useUserStore } from '@/store/useUserStore';
import { useLanguageStore } from '@/store/useLanguageStore';
import { useNotificationStore } from '@/store/useNotificationStore';
import { useT } from '@/hooks/useT';
import { registerDevice, saveDeviceFid } from '@/store/pushDevice';
import { hasNativeToken, nativePushPermission, nativePushToken, requestNativePushPermission, saveNativeToken } from '@/store/nativePush';
import { setupForegroundListener, setupNativeListener } from './pushListeners';
import { isNativeApp } from '@/lib/nativeApp';

// Get VAPID key from environment variables
const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

// Uid whose FCM registration was silently refreshed this page session (once per sign-in).
let silentRefreshUid: string | null = null;

const isNotificationSupported = () => 'Notification' in globalThis;


export const usePushNotifications = () => {
  // Read on the first render (the consumers render client-side only; the server has no Notification).
  const [isPermissionGranted, setIsPermissionGranted] = useState(
    () => !isNativeApp() && isNotificationSupported() && globalThis.Notification.permission === 'granted',
  );
  // The app may still show its permission dialog (read from the plugin, see below).
  const [nativeCanAsk, setCanAsk] = useState(false);
  // The one-time offer may still ask: the browser (read live, as before) or the app has not decided yet.
  const canAsk = isNativeApp()
    ? nativeCanAsk
    : isNotificationSupported() && globalThis.Notification.permission === 'default';
  const [isLoading, setIsLoading] = useState(false);
  const { user, loading: authLoading } = useUserStore();
  const { language } = useLanguageStore();
  const { addNotification } = useNotificationStore();
  // Memoized per language by useT (same stability as the former useCallback on language)
  const t = useT();


  // Registers this device with FCM (its Firebase Installation ID) through our service worker.
  const registerForPush = async () => {
    if (!('serviceWorker' in navigator)) {
      return null;
    }

    const registration = await navigator.serviceWorker.register('/api/firebase-messaging-sw', {
      scope: '/',
    });

    await navigator.serviceWorker.ready;

    if (!VAPID_KEY) {
      console.error('VAPID_KEY not configured');
      return null;
    }

    const messaging = getMessaging(app);
    const fid = await registerDevice(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
    return { messaging, fid };
  };

  // The app reads its permission asynchronously (the plugin); browsers have it on the first render.
  useEffect(() => {
    if (!isNativeApp()) return;
    let cancelled = false;
    nativePushPermission()
      .then((permission) => {
        if (cancelled) return;
        // "On" means this device has a saved token: Android 12 and older always report 'granted', and
        // another account may have allowed it on this device before.
        setIsPermissionGranted(permission === 'granted' && hasNativeToken());
        setCanAsk(permission !== 'denied' && !hasNativeToken());
      })
      .catch((error) => console.error('Reading the notification permission failed:', error));
    return () => {
      cancelled = true;
    };
  }, []);

  // The user fields that go with this device's registration (browser FID or app token).
  const registrationFields = async (uid: string) => {
    const userRef = doc(db, 'users', uid);
    const defaultSettings = {
      spotApproved: true,
      spotReviewed: true,
      newPendingSpot: true,
      follows: true,
    };

    // Never overwrite the user's stored notification choices (BUG-02)
    const userSnap = await getDoc(userRef);
    const hasSettings = Boolean(userSnap.data()?.notificationSettings);
    return {
      language: language ?? 'hu',
      notificationsEnabled: true,
      lastTokenUpdate: new Date().toISOString(),
      ...(hasSettings ? {} : { notificationSettings: defaultSettings }),
    };
  };

  const saveUserFid = async (fid: string) => {
    if (!user) return;
    // Remembered so signOut can remove this device's registration (SEC-14).
    await saveDeviceFid(user.uid, fid, await registrationFields(user.uid));
  };

  // After sign-in / user load: if this device already granted permission and has the FCM service
  // worker, silently re-register it (sign-out unregisters it; devices from before v2.1.0 move from
  // a token to their FID here). Never prompts, no UI; skipped
  // when the user turned notifications off in Settings.
  useEffect(() => {
    if (authLoading) return; // wait for auth: the persisted user may be stale
    if (!user) {
      silentRefreshUid = null;
      return;
    }
    if (silentRefreshUid === user.uid) return;
    silentRefreshUid = user.uid;

    const refreshNative = async () => {
      try {
        if ((await nativePushPermission()) !== 'granted') return;
        const userSnap = await getDoc(doc(db, 'users', user.uid));
        // Only re-register users who explicitly opted in; never opt someone in silently (shared devices).
        if (userSnap.data()?.notificationsEnabled !== true) return;
        const token = await nativePushToken();
        // Bail if the user signed out (or switched) while we were awaiting.
        if (useUserStore.getState().user?.uid !== user.uid) return;
        await saveNativeToken(user.uid, token, await registrationFields(user.uid));
        setupNativeListener();
      } catch (error) {
        console.error('Silent FCM registration refresh failed:', error);
      }
    };

    const refresh = async () => {
      try {
        if (!isNotificationSupported() || globalThis.Notification.permission !== 'granted') return;
        if (!(await isSupported())) return;
        if (!('serviceWorker' in navigator) || !VAPID_KEY) return;
        const registration = await navigator.serviceWorker.getRegistration('/');
        if (!registration) return;

        const userSnap = await getDoc(doc(db, 'users', user.uid));
        // Only re-register users who explicitly opted in; never opt someone in silently (shared devices).
        if (userSnap.data()?.notificationsEnabled !== true) return;

        const messaging = getMessaging(app);
        const fid = await registerDevice(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
        // Bail if the user signed out (or switched) while we were awaiting.
        if (useUserStore.getState().user?.uid !== user.uid) return;
        await saveUserFid(fid);
        setupForegroundListener(messaging);
      } catch (error) {
        console.error('Silent FCM registration refresh failed:', error);
      }
    };
    void (isNativeApp() ? refreshNative() : refresh());
    // Runs once per signed-in uid; saveUserFid reads the current user/language from this render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, authLoading]);

  // Initialize push notifications
  // The Android/iOS app: the system permission dialog and a native FCM token (store/nativePush.ts).
  const initializeNativePush = async (): Promise<boolean> => {
    if (!user) return false;
    try {
      setIsLoading(true);
      const granted = await requestNativePushPermission();
      setIsPermissionGranted(granted);
      setCanAsk(false);
      if (!granted) {
        addNotification({
          title: t('notificationsBlocked'),
          body: t('notificationsBlockedDescApp'),
          type: 'warning',
        });
        return false;
      }
      const token = await nativePushToken();
      await saveNativeToken(user.uid, token, await registrationFields(user.uid));
      setupNativeListener();
      return true;
    } catch (error) {
      console.error('Failed to initialize push notifications:', error);
      addNotification({
        title: t('notificationsBlocked'),
        body: String(error),
        type: 'warning',
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const initializePush = async (): Promise<boolean> => {
    if (isNativeApp()) return initializeNativePush();
    try {
      if (!isNotificationSupported()) {
        return false;
      }

      const messagingSupported = await isSupported();
      if (!messagingSupported || !user) {
        return false;
      }

      setIsLoading(true);

      const permission = await globalThis.Notification.requestPermission();
      if (permission !== 'granted') {
        setIsPermissionGranted(false);
        if (permission === 'denied') {
          // Route to notification center instead of toast
          addNotification({
            title: t('notificationsBlocked'),
            body: t('notificationsBlockedDesc'),
            type: 'warning',
          });
        }
        return false;
      }

      setIsPermissionGranted(true);

      const registered = await registerForPush();
      if (!registered) {
        return false;
      }

      await saveUserFid(registered.fid);

      // Singleton: Only setup listener if not already done
      setupForegroundListener(registered.messaging);
      return true;
    } catch (error) {
      console.error('Failed to initialize push notifications:', error);
      addNotification({
        title: t('notificationsBlocked'),
        body: String(error),
        type: 'warning',
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Request permission explicitly (for button click)
  const requestPermission = async (): Promise<boolean> => {
    return await initializePush();
  };

  // Disable notifications
  const disableNotifications = async (): Promise<void> => {
    if (!user) return;

    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        notificationsEnabled: false,
      });
      setIsPermissionGranted(false);
      addNotification({
        title: t('notificationsDisabled'),
        body: '',
        type: 'system',
      });
    } catch (error) {
      console.error('Failed to disable notifications:', error);
      addNotification({
        title: t('errorSavingSettings'),
        body: String(error),
        type: 'warning',
      });
    }
  };

  return {
    isPermissionGranted,
    canAsk,
    isLoading,
    initializePush,
    requestPermission,
    disableNotifications,
  };
};
