import { create } from 'zustand';
import { doc, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { DEFAULT_APP_CONFIG, parseAppConfig, type AppConfig } from '@/lib/appConfig';

interface AppConfigStore {
  config: AppConfig;
  /** Listens to config/app (public; idempotent). */
  start: () => void;
  stop: () => void;
}

let unsubscribe: Unsubscribe | null = null;

export const useAppConfigStore = create<AppConfigStore>((set) => ({
  config: DEFAULT_APP_CONFIG,
  start: () => {
    if (unsubscribe) return;
    unsubscribe = onSnapshot(
      doc(db, 'config', 'app'),
      (snap) => set({ config: parseAppConfig(snap.data()) }),
      (error) => console.warn('config/app unavailable:', error),
    );
  },
  stop: () => {
    unsubscribe?.();
    unsubscribe = null;
  },
}));
