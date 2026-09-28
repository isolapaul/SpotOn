import { useState } from 'react';
import type { Spot } from '@/store/useSpotStore';
import { useUserStore, userErrorKey } from '@/store/useUserStore';
import { useToastStore } from '@/store/useToastStore';
import { useT } from '@/hooks/useT';
import { highlightErrorKey, isHighlightedBy } from '@/lib/highlights';

export interface SpotHighlight {
  /** Whether the signed-in user has an active highlight on the spot. */
  isHighlightedByUser: boolean;
  isHighlighting: boolean;
  /** Calls the highlightSpot callable (via the store) and toasts the result. */
  highlight: () => Promise<void>;
}

/**
 * Highlight state for the shown spot (T28), shared by SpotHero (button) and SpotTitle (star).
 * Pass the live store copy of the spot, so the state flips once the listener delivers the entry.
 */
export function useSpotHighlight(spot: Spot | null): SpotHighlight {
  const user = useUserStore((s) => s.user);
  const highlightSpot = useUserStore((s) => s.highlightSpot);
  const showToast = useToastStore((s) => s.showToast);
  const t = useT();
  const [isHighlighting, setIsHighlighting] = useState(false);

  const isHighlightedByUser = !!spot && !!user && isHighlightedBy(spot, user.uid);

  const highlight = async () => {
    if (!spot) return;
    if (!user || isHighlightedByUser) {
      if (isHighlightedByUser) showToast(t('youHighlightedThis'), 'error');
      return;
    }
    setIsHighlighting(true);
    try {
      await highlightSpot(spot.id);
      showToast(t('highlightSuccess'), 'success');
    } catch (error) {
      showToast(t(highlightErrorKey(error) ?? userErrorKey(error) ?? 'highlightError'), 'error');
    } finally {
      setIsHighlighting(false);
    }
  };

  return { isHighlightedByUser, isHighlighting, highlight };
}
