import { create } from 'zustand';
import { useNotificationStore } from './useNotificationStore';

export type ToastType = 'success' | 'error' | 'info';

// Map toast types to notification titles
const toastTitles: Record<ToastType, string> = {
  success: '✅ Success',
  error: '❌ Error',
  info: 'ℹ️ Info',
};

interface ToastStore {
  showToast: (message: string, type: ToastType) => void;
}

export const useToastStore = create<ToastStore>(() => ({
  showToast: (message, type) => {
    // Redirect to notification store instead of showing a popup
    const { addNotification } = useNotificationStore.getState();
    
    addNotification({
      title: toastTitles[type] || 'Notification',
      body: message,
      type: type, // 'success' | 'error' | 'info' now valid types
    });
    
    // Silently logged - no visual popup
    console.log(`[Silent Toast → Notification] ${type}: ${message}`);
  },
}));
