import { useHorizontalSwipe, type HorizontalSwipe, type SwipeDirection } from './useHorizontalSwipe';

export interface SwipeToCloseOptions {
  onClose: () => void;
  threshold: number;
  direction: SwipeDirection;
}

/** Swipe-to-close for full-screen panels: any swipe past the threshold closes (T25, DUP-02). */
export function useSwipeToClose({ onClose, threshold, direction }: SwipeToCloseOptions): HorizontalSwipe {
  return useHorizontalSwipe({ threshold, direction, onSwipe: () => onClose() });
}
