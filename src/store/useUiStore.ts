import { create } from 'zustand';

interface UiStore {
  notificationPromptVisible: boolean;
  setNotificationPromptVisible: (v: boolean) => void;
  movedBannerVisible: boolean;
  setMovedBannerVisible: (v: boolean) => void;
}

export const useUiStore = create<UiStore>((set) => ({
  notificationPromptVisible: false,
  setNotificationPromptVisible: (v: boolean) => set({ notificationPromptVisible: v }),
  movedBannerVisible: false,
  setMovedBannerVisible: (v: boolean) => set({ movedBannerVisible: v }),
}));

export default useUiStore;
