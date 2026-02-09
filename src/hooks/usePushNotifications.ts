import { useEffect, useState } from 'react';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db, app } from '@/lib/firebase';
import { useUserStore } from '@/store/useUserStore';
import { useLanguageStore } from '@/store/useLanguageStore';
import { useToastStore } from '@/store/useToastStore';
import { useNotificationStore } from '@/store/useNotificationStore';

// Get VAPID key from environment variables
const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

export const usePushNotifications = () => {
  const [isPermissionGranted, setIsPermissionGranted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [foregroundUnsubscribe, setForegroundUnsubscribe] = useState<(() => void) | null>(null);
  const { user } = useUserStore();
  const { language } = useLanguageStore();
  const { showToast } = useToastStore();
  const { addNotification } = useNotificationStore();

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
      showToast('Push notifications configuration error', 'error');
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
      if (foregroundUnsubscribe) {
        foregroundUnsubscribe();
        setForegroundUnsubscribe(null);
      }

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
          showToast('Notifications blocked. Enable them in browser settings.', 'error');
        }
        return false;
      }

      setIsPermissionGranted(true);

      const tokenResult = await getMessagingToken();
      if (!tokenResult) {
        return false;
      }

      await saveUserToken(tokenResult.token);
      setupForegroundListener(tokenResult.messaging);
      return true;
    } catch (error) {
      console.error('Failed to initialize push notifications:', error);
      showToast('Failed to enable notifications', 'error');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Setup foreground message listener (when app is open)
  const setupForegroundListener = (messaging: any) => {
    const unsubscribe = onMessage(messaging, (payload) => {
      console.log('Foreground message received:', payload);
      
      // Show toast notification when app is in foreground
      const title = payload.notification?.title || 'New Notification';
      const body = payload.notification?.body || '';
      
      // Add to notification center
      const notificationType = payload.data?.type || 'general';
      addNotification({
        title,
        body,
        type: notificationType as any,
      });
      
      showToast(`${title}: ${body}`, 'info');
      
      // You can also show a native notification if desired
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
    
    // Store unsubscribe function for cleanup
    setForegroundUnsubscribe(() => unsubscribe);
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
      showToast('Notifications disabled', 'info');
    } catch (error) {
      console.error('Failed to disable notifications:', error);
      showToast('Failed to disable notifications', 'error');
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
