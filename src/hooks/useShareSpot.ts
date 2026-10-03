import { useCallback } from 'react';
import type { Spot } from '@/store/useSpotStore';
import { useToastStore } from '@/store/useToastStore';
import { spotLink } from '@/lib/spotLinks';
import { useT } from './useT';

/** Shares a spot's public link: the system share sheet, else the clipboard (with a notice). */
export function useShareSpot(): (spot: Pick<Spot, 'id' | 'name'>) => Promise<void> {
  const t = useT();
  return useCallback(async (spot) => {
    const url = spotLink(globalThis.location.origin, spot.id);
    if (navigator.share) {
      try {
        await navigator.share({ title: spot.name, url });
        return;
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      useToastStore.getState().showToast(t('linkCopied'), 'success');
    } catch {
      useToastStore.getState().showToast(url, 'info');
    }
  }, [t]);
}
