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

// Validate VAPID key is present
if (!VAPID_KEY) {
  console.error('❌ FIREBASE VAPID KEY IS MISSING!');
  console.error('Please add NEXT_PUBLIC_FIREBASE_VAPID_KEY to your .env.local file');
}

export const usePushNotifications = () => {
  const [isPermissionGranted, setIsPermissionGranted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useUserStore();
  const { language } = useLanguageStore();
  const { showToast } = useToastStore();
  const { addNotification } = useNotificationStore();

  // Check if notifications are supported and permission status
  useEffect(() => {
    if ('Notification' in window) {
      setIsPermissionGranted(Notification.permission === 'granted');
    }
  }, []);

  // Initialize push notifications
  const initializePush = async (): Promise<boolean> => {
    try {
      // Check if the browser supports notifications
      if (!('Notification' in window)) {
        console.log('This browser does not support notifications');
        return false;
      }

      // Check if Firebase Messaging is supported
      const messagingSupported = await isSupported();
      if (!messagingSupported) {
        console.log('Firebase Messaging is not supported in this browser');
        return false;
      }

      // Check if user is logged in
      if (!user) {
        console.log('User not logged in');
        return false;
      }

      setIsLoading(true);

      // Request notification permission
      const permission = await Notification.requestPermission();
      
      if (permission === 'granted') {
        setIsPermissionGranted(true);
        
        // Register service worker (dynamically generated)
        if ('serviceWorker' in navigator) {
          const registration = await navigator.serviceWorker.register('/api/firebase-messaging-sw', {
            scope: '/',
          });
          console.log('Service Worker registered:', registration);

          // Wait for service worker to be ready
          await navigator.serviceWorker.ready;

          // Validate VAPID key before requesting token
          if (!VAPID_KEY) {
            console.error('❌ Cannot request FCM token: VAPID key is missing');
            showToast('Push notifications configuration error', 'error');
            setIsLoading(false);
            return false;
          }

          // Get FCM token
          const messaging = getMessaging(app);
          const token = await getToken(messaging, {
            vapidKey: VAPID_KEY,
            serviceWorkerRegistration: registration,
          });

          if (token) {
            // Save token to Firestore
            const userRef = doc(db, 'users', user.uid);
            await updateDoc(userRef, {
              fcmTokens: arrayUnion(token),
              language: language,
              notificationsEnabled: true,
              lastTokenUpdate: new Date().toISOString(),
            });

            console.log('FCM token saved to Firestore');
            
            // Setup foreground message listener
            setupForegroundListener(messaging);
            
            setIsLoading(false);
            return true;
          }
        }
      } else if (permission === 'denied') {
        setIsPermissionGranted(false);
        console.log('Notification permission denied');
        showToast('Notifications blocked. Enable them in browser settings.', 'error');
      }

      setIsLoading(false);
      return false;
    } catch (error) {
      console.error('Error initializing push notifications:', error);
      setIsLoading(false);
      return false;
    }
  };

  // Setup foreground message listener (when app is open)
  const setupForegroundListener = (messaging: any) => {
    onMessage(messaging, (payload) => {
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
      console.error('Error disabling notifications:', error);
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
