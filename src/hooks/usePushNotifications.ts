import { useEffect, useState, useCallback } from 'react';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db, app } from '@/lib/firebase';
import { useUserStore } from '@/store/useUserStore';
import { useLanguageStore } from '@/store/useLanguageStore';
import { useNotificationStore } from '@/store/useNotificationStore';
import { translations } from '@/lib/translations';

// Get VAPID key from environment variables
const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

// Singleton: Module-level variable to track foreground listener
// This ensures only ONE listener is active across all hook instances
let listenerSetup = false;

// Uid whose FCM token was silently refreshed this page session (once per sign-in).
let silentRefreshUid: string | null = null;

export const usePushNotifications = () => {
  const [isPermissionGranted, setIsPermissionGranted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { user, loading: authLoading } = useUserStore();
  const { language } = useLanguageStore();
  const { addNotification } = useNotificationStore();
  
  // Helper to get translation
  const t = useCallback((key: string) => (translations[language || 'hu'] as any)[key] || key, [language]);

  const isNotificationSupported = () => 'Notification' in globalThis;

  // Check if notifications are supported and permission status
  useEffect(() => {
    if (isNotificationSupported()) {
      setIsPermissionGranted(globalThis.Notification.permission === 'granted');
    }
  }, []);

  const getMessagingToken = async () => {
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
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (!token) {
      return null;
    }

    return { messaging, token };
  };

  const saveUserToken = async (token: string) => {
    if (!user) return;

    const userRef = doc(db, 'users', user.uid);
    const defaultSettings = {
      spotApproved: true,
      spotReviewed: true,
      newPendingSpot: true,
    };

    // Never overwrite the user's stored notification choices (BUG-02)
    const userSnap = await getDoc(userRef);
    const hasSettings = Boolean(userSnap.data()?.notificationSettings);

    await updateDoc(userRef, {
      fcmTokens: arrayUnion(token),
      language: language ?? 'hu',
      notificationsEnabled: true,
      lastTokenUpdate: new Date().toISOString(),
      ...(hasSettings ? {} : { notificationSettings: defaultSettings }),
    });

    // Remembered so signOut can remove this device's token (SEC-14)
    useUserStore.getState().rememberFcmToken(token);
  };

  // After sign-in / user load: if this device already granted permission and has the FCM service
  // worker, silently re-register its token (sign-out deletes it). Never prompts, no UI; skipped
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

        const token = await getToken(getMessaging(app), {
          vapidKey: VAPID_KEY,
          serviceWorkerRegistration: registration,
        });
        // Bail if the user signed out (or switched) while we were awaiting.
        if (useUserStore.getState().user?.uid !== user.uid) return;
        if (token) await saveUserToken(token);
      } catch (error) {
        console.error('Silent FCM token refresh failed:', error);
      }
    };
    void refresh();
    // Runs once per signed-in uid; saveUserToken reads the current user/language from this render.
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

      const tokenResult = await getMessagingToken();
      if (!tokenResult) {
        return false;
      }

      await saveUserToken(tokenResult.token);
      
      // Singleton: Only setup listener if not already done
      if (!listenerSetup) {
        setupForegroundListener(tokenResult.messaging);
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

  // Setup foreground message listener (when app is open) - SINGLETON
  const setupForegroundListener = (messaging: any) => {
    // Prevent duplicate listeners
    if (listenerSetup) {
      console.log('Foreground listener already set up, skipping...');
      return;
    }
    
    listenerSetup = true;
    
    onMessage(messaging, (payload) => {
      console.log('Foreground message received:', payload);
      
      const title = payload.notification?.title || 'New Notification';
      const body = payload.notification?.body || '';
      
      // Add to notification center only (no toast to avoid stacking)
      const notificationType = payload.data?.type || 'general';
      // Use the store directly to avoid stale closure issues
      useNotificationStore.getState().addNotification({
        title,
        body,
        type: notificationType as any,
      });
      
      // Do NOT show a native browser Notification here to avoid duplicates
      // (the service worker will display notifications when the app is backgrounded,
      // and in-foreground we add items to the in-app NotificationCenter instead).
    });
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
