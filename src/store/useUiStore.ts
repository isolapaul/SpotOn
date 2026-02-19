import { create } from 'zustand';

interface UiStore {
  notificationPromptVisible: boolean;
  setNotificationPromptVisible: (v: boolean) => void;
}

export const useUiStore = create<UiStore>((set) => ({
  notificationPromptVisible: false,
  setNotificationPromptVisible: (v: boolean) => set({ notificationPromptVisible: v }),
}));

export default useUiStore;
