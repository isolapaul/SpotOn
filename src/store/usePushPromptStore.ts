import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * When to offer push notifications: once, right after the user's first successful contribution
 * (spot, review or photos), when the offer makes sense ("we tell you when it is approved"),
 * instead of a timer after sign-in. Settings keeps the manual switch.
 */
interface PushPromptStore {
  /** Answered on this device (enabled or "not now"): never offered automatically again. */
  answered: boolean;
  /** A contribution succeeded and asks for the offer (not persisted). */
  requested: boolean;
  request: () => void;
  answer: () => void;
}

export const usePushPromptStore = create<PushPromptStore>()(
  persist(
    (set, get) => ({
      answered: false,
      requested: false,
      request: () => {
        if (!get().answered) set({ requested: true });
      },
      answer: () => set({ answered: true, requested: false }),
    }),
    {
      name: 'spoton-push-prompt',
      partialize: (s) => ({ answered: s.answered }),
    },
  ),
);
