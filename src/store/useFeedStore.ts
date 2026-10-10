import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { FEED_PAGE_SIZE } from '@/lib/feed';

interface FeedStore {
  /** When the feed was last opened on this device (ms; 0 = never): newer followed spots light the dot. */
  seenAt: number;
  markSeen: (now: number) => void;
  /** Cards rendered; grows while scrolling. Kept while the feed is closed (back from a spot). */
  visibleCount: number;
  showMore: () => void;
  scrollTop: number;
  rememberScroll: (scrollTop: number) => void;
}

/** The following feed's view state: the last visit (persisted), the page count and the scroll. */
export const useFeedStore = create<FeedStore>()(
  persist(
    (set) => ({
      seenAt: 0,
      markSeen: (now) => set({ seenAt: now }),
      visibleCount: FEED_PAGE_SIZE,
      showMore: () => set((s) => ({ visibleCount: s.visibleCount + FEED_PAGE_SIZE })),
      scrollTop: 0,
      rememberScroll: (scrollTop) => set({ scrollTop }),
    }),
    { name: 'spoton-feed', partialize: (s) => ({ seenAt: s.seenAt }) },
  ),
);
