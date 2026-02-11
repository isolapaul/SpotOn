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
  toasts: never[]; // Keep interface for backward compatibility but never show
  showToast: (message: string, type: ToastType) => void;
  removeToast: (id: number) => void;
}

export const useToastStore = create<ToastStore>(() => ({
  toasts: [],
  
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
  
  removeToast: () => {
    // No-op: no visual toasts to remove
  },
}));
