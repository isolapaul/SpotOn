import { create } from 'zustand';
import type { CategoryId } from './useSpotStore';
import { DISCOVERY_BATCH_SIZE } from '@/lib/constants';

export type DiscoverySort = 'nearest' | 'best-rated';

/**
 * Explore's list view: the order, the category filter, how many rows are shown and where the list was
 * scrolled. Kept while the panel is closed, so closing a spot opened from Explore returns to the same
 * list. Not persisted: a reload starts fresh.
 */
interface DiscoveryStore {
  sortBy: DiscoverySort;
  filterCategory: CategoryId | null;
  visibleCount: number;
  scrollTop: number;
  /** A new order or filter starts at the top with the first batch. */
  setSort: (sortBy: DiscoverySort) => void;
  setCategory: (category: CategoryId | null) => void;
  showMore: () => void;
  rememberScroll: (scrollTop: number) => void;
}

export const useDiscoveryStore = create<DiscoveryStore>((set) => ({
  sortBy: 'best-rated',
  filterCategory: null,
  visibleCount: DISCOVERY_BATCH_SIZE,
  scrollTop: 0,
  setSort: (sortBy) => set({ sortBy, visibleCount: DISCOVERY_BATCH_SIZE, scrollTop: 0 }),
  setCategory: (filterCategory) => set({ filterCategory, visibleCount: DISCOVERY_BATCH_SIZE, scrollTop: 0 }),
  showMore: () => set((s) => ({ visibleCount: s.visibleCount + DISCOVERY_BATCH_SIZE })),
  rememberScroll: (scrollTop) => set({ scrollTop }),
}));
