import { useCallback } from 'react';
import type { Spot } from '@/store/useSpotStore';
import { useToastStore } from '@/store/useToastStore';
import { spotLink } from '@/lib/spotLinks';
import { isNativeApp } from '@/lib/nativeApp';
import { useT } from './useT';

/** Shares a spot's public link: the system share sheet (native in the app), else the clipboard (with a notice). */
export function useShareSpot(): (spot: Pick<Spot, 'id' | 'name'>) => Promise<void> {
  const t = useT();
  return useCallback(async (spot) => {
    const url = spotLink(globalThis.location.origin, spot.id);
    // The Android/iOS app: the system share sheet (Android's WebView has no navigator.share).
    if (isNativeApp()) {
      try {
        const { Share } = await import('@capacitor/share');
        await Share.share({ title: spot.name, url });
        return;
      } catch (error) {
        // Closing the share sheet rejects too: nothing more to do then.
        if (error instanceof Error && /cancel/i.test(error.message)) return;
      }
    }
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
