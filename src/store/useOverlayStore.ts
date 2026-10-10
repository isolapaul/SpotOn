import { create } from 'zustand';

interface Overlay {
  id: number;
  close: () => void;
}

interface OverlayStore {
  /** Sheets open over a panel (comments, likers, follower lists), the newest last. */
  stack: Overlay[];
  push: (overlay: Overlay) => void;
  remove: (id: number) => void;
}

/**
 * The sheets open over the panels: the system back and Escape close the newest one first
 * (page.tsx), instead of the whole panel under it.
 */
export const useOverlayStore = create<OverlayStore>((set) => ({
  stack: [],
  push: (overlay) => set((s) => ({ stack: [...s.stack, overlay] })),
  remove: (id) => set((s) => ({ stack: s.stack.filter((o) => o.id !== id) })),
}));

/** Closes the newest sheet; false when none is open. */
export function closeTopOverlay(): boolean {
  const top = useOverlayStore.getState().stack.at(-1);
  if (!top) return false;
  top.close();
  return true;
}
