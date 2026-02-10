import { useEffect, useState, useCallback } from 'react';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db, app } from '@/lib/firebase';
import { useUserStore } from '@/store/useUserStore';
import { useLanguageStore } from '@/store/useLanguageStore';
import { useNotificationStore } from '@/store/useNotificationStore';
import { translations } from '@/lib/translations';

// Get VAPID key from environment variables
const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

// Singleton: Module-level variable to track foreground listener
// This ensures only ONE listener is active across all hook instances
let globalForegroundUnsubscribe: (() => void) | null = null;
let listenerSetup = false;

export const usePushNotifications = () => {
  const [isPermissionGranted, setIsPermissionGranted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useUserStore();
  const { language } = useLanguageStore();
  const { addNotification } = useNotificationStore();
  
  // Helper to get translation
  const t = useCallback((key: keyof typeof translations.hu) => translations[language || 'hu'][key] || key, [language]);

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

    await updateDoc(userRef, {
      fcmTokens: arrayUnion(token),
      language: language,
      notificationsEnabled: true,
      lastTokenUpdate: new Date().toISOString(),
      ...(user.notificationSettings ? {} : { notificationSettings: defaultSettings }),
    });
  };

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
    
    const unsubscribe = onMessage(messaging, (payload) => {
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
      
      // Show native browser notification if permitted
      if (Notification.permission === 'granted') {
        new Notification(title, {
          body: body,
          icon: '/icon-192x192.png',
          badge: '/icon-192x192.png',
          tag: payload.data?.tag || 'spoton-foreground',
          data: payload.data,
        });
      }
    });
    
    // Store unsubscribe function globally
    globalForegroundUnsubscribe = unsubscribe;
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
