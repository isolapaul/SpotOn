'use client';

import { useEffect, useState } from 'react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useUserStore } from '@/store/useUserStore';
import { useLanguageStore } from '@/store/useLanguageStore';
import { useUiStore } from '@/store/useUiStore';

export default function NotificationPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const { user } = useUserStore();
  const { t } = useLanguageStore();
  const { isPermissionGranted, isLoading, initializePush } = usePushNotifications();
  const { setNotificationPromptVisible } = useUiStore();

  useEffect(() => {
    // Check if we should show the prompt
    const checkPrompt = async () => {
      if (!user) return;
      
      // Don't show if already granted
      if (isPermissionGranted) return;
      
      // Check if user dismissed it in this session
      const dismissed = sessionStorage.getItem('notification-prompt-dismissed');
      if (dismissed) return;
      
      // Check notification permission status
      if ('Notification' in window) {
        const permission = Notification.permission;
        
        // Only show if permission is 'default' (not asked yet)
        if (permission === 'default') {
          // Wait a bit before showing (better UX)
          setTimeout(() => {
            setShowPrompt(true);
          }, 3000);
        }
      }
    };

    checkPrompt();
  }, [user, isPermissionGranted]);

  // Sync visibility with global UI store so other components can react
  useEffect(() => {
    setNotificationPromptVisible(!!showPrompt && !isDismissed);
    return () => setNotificationPromptVisible(false);
  }, [showPrompt, isDismissed, setNotificationPromptVisible]);

  const handleEnable = async () => {
    const success = await initializePush();
    if (success) {
      setShowPrompt(false);
      setNotificationPromptVisible(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setIsDismissed(true);
    sessionStorage.setItem('notification-prompt-dismissed', 'true');
    setNotificationPromptVisible(false);
  };

  if (!showPrompt || !user || isDismissed) {
    return null;
  }

  return (
    <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 
      max-w-md w-[calc(100%-2rem)] animate-fade-in">
      <div className="glass-card p-4 shadow-lg">
        <div className="flex items-start gap-3">
          <div className="text-2xl">🔔</div>
          <div className="flex-1">
            <h3 className="text-white font-semibold mb-1">
              {t('enableNotifications')}
            </h3>
            <p className="text-white/70 text-sm mb-3">
              {t('notificationPromptText')}
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleEnable}
                disabled={isLoading}
                className="flex-1 py-2 px-4 rounded-lg bg-white/20 text-white font-medium
                  hover:bg-white/30 active:scale-95 transition-all disabled:opacity-50 touch-manipulation"
              >
                {isLoading ? t('enabling') : t('enable')}
              </button>
              <button
                onClick={handleDismiss}
                className="py-2 px-4 rounded-lg bg-white/10 text-white/70 font-medium
                  hover:bg-white/20 active:scale-95 transition-all touch-manipulation"
              >
                {t('notNow')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
