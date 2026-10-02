import { useEffect, useState } from 'react';
import { getMessaging, onMessage, onRegistered, isSupported, type Messaging } from 'firebase/messaging';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db, app } from '@/lib/firebase';
import { useUserStore } from '@/store/useUserStore';
import { useLanguageStore } from '@/store/useLanguageStore';
import { useNotificationStore, type Notification as AppNotification } from '@/store/useNotificationStore';
import { translate } from '@/lib/i18n';
import { useT } from '@/hooks/useT';
import { registerDevice, rememberedFid, saveDeviceFid } from '@/store/pushDevice';

// Get VAPID key from environment variables
const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

// Singleton: Module-level variable to track foreground listener
// This ensures only ONE listener is active across all hook instances
let listenerSetup = false;

// Uid whose FCM registration was silently refreshed this page session (once per sign-in).
let silentRefreshUid: string | null = null;

const isNotificationSupported = () => 'Notification' in globalThis;

// Setup foreground message listener (when app is open) - SINGLETON
function setupForegroundListener(messaging: Messaging) {
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
    // Moderation decisions also land in the server inbox (item 4), which the centre shows already.
    if (payload.data?.inbox === '1') return;
    // Read the language at message time: this listener is registered once (no stale closure).
    const title = payload.notification?.title || translate(useLanguageStore.getState().language ?? 'hu', 'newNotification');
    const body = payload.notification?.body || '';
    
    // Add to notification center only (no toast to avoid stacking)
    const notificationType = payload.data?.type || 'general';
    // Use the store directly to avoid stale closure issues
    useNotificationStore.getState().addNotification({
      title,
      body,
      // The server sends only known kinds; the value is passed through unchecked, as before.
      type: notificationType as AppNotification['type'],
    });
    
    // Do NOT show a native browser Notification here to avoid duplicates
    // (the service worker will display notifications when the app is backgrounded,
    // and in-foreground we add items to the in-app NotificationCenter instead).
  });
}

export const usePushNotifications = () => {
  // Read on the first render (the consumers render client-side only; the server has no Notification).
  const [isPermissionGranted, setIsPermissionGranted] = useState(
    () => isNotificationSupported() && globalThis.Notification.permission === 'granted',
  );
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

  const saveUserFid = async (fid: string) => {
    if (!user) return;

    const userRef = doc(db, 'users', user.uid);
    const defaultSettings = {
      spotApproved: true,
      spotReviewed: true,
      newPendingSpot: true,
      follows: true,
    };

    // Never overwrite the user's stored notification choices (BUG-02)
    const userSnap = await getDoc(userRef);
    const hasSettings = Boolean(userSnap.data()?.notificationSettings);

    // Remembered so signOut can remove this device's registration (SEC-14).
    await saveDeviceFid(user.uid, fid, {
      language: language ?? 'hu',
      notificationsEnabled: true,
      lastTokenUpdate: new Date().toISOString(),
      ...(hasSettings ? {} : { notificationSettings: defaultSettings }),
    });
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
        if (!listenerSetup) setupForegroundListener(messaging);
      } catch (error) {
        console.error('Silent FCM registration refresh failed:', error);
      }
    };
    void refresh();
    // Runs once per signed-in uid; saveUserFid reads the current user/language from this render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, authLoading]);

  // Initialize push notifications
  const initializePush = async (): Promise<boolean> => {
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
      if (!listenerSetup) {
        setupForegroundListener(registered.messaging);
      }
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
    isLoading,
    initializePush,
    requestPermission,
    disableNotifications,
  };
};
