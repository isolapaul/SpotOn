import { useCallback } from 'react';
import { APP_BUILD, SITE_URL } from '@/lib/constants';
import type { Spot } from '@/store/useSpotStore';
import { spotLink } from '@/lib/spotLinks';
import { useT } from './useT';
import { track } from '@/store/telemetry';
import { shareLink } from './shareLink';

/** Shares a spot's public link: the system share sheet (native in the app), else the clipboard (with a notice). */
export function useShareSpot(): (spot: Pick<Spot, 'id' | 'name'>) => Promise<void> {
  const t = useT();
  return useCallback(async (spot) => {
    // The public address (inside the app the page runs on a local origin).
    const url = spotLink(APP_BUILD ? SITE_URL : globalThis.location.origin, spot.id);
    if (await shareLink({ title: spot.name, url }, t('linkCopied')) === 'shared') track('spot_shared');
  }, [t]);
}
