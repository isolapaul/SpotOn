import { create } from 'zustand';
import { useNotificationStore } from './useNotificationStore';
import { useLanguageStore } from './useLanguageStore';
import { translate } from '@/lib/i18n';
import type { TranslationKey } from '@/lib/translations';

export type ToastType = 'success' | 'error' | 'info';

// Notification title per toast type (translated word; the notification center shows the type as an icon)
function toastTitle(type: ToastType): string {
  const lang = useLanguageStore.getState().language ?? 'hu';
  const t = (key: TranslationKey) => translate(lang, key);
  if (type === 'success') return t('toastSuccess');
  if (type === 'error') return t('toastError');
  if (type === 'info') return t('toastInfo');
  return t('notificationDefaultTitle');
}

interface ToastStore {
  showToast: (message: string, type: ToastType) => void;
}

export const useToastStore = create<ToastStore>(() => ({
  showToast: (message, type) => {
    // Redirect to notification store instead of showing a popup
    const { addNotification } = useNotificationStore.getState();

    addNotification({
      title: toastTitle(type),
      body: message,
      type: type, // 'success' | 'error' | 'info' now valid types
    });
  },
}));
