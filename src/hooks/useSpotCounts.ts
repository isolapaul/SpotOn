import { useEffect, useState } from 'react';
import { fetchSpotCounts, recordSpotView, type SpotCounts } from '@/store/spotStats';
import { useUserStore } from '@/store/useUserStore';

/**
 * The details' view and visit counts (growth plan §3): counts this view (signed in, not the owner,
 * approved spots: the server decides), then reads the public counters. `bumpVisit` adds a visit
 * locally after "I was here".
 */
export function useSpotCounts(spotId: string | null, approved: boolean) {
  const uid = useUserStore((s) => s.user?.uid ?? null);
  // Keyed by spot, so another spot never shows the previous one's counts.
  const [state, setState] = useState<{ spotId: string; counts: SpotCounts } | null>(null);
  useEffect(() => {
    if (!spotId || !approved) return;
    let live = true;
    (async () => {
      const counted = uid ? await recordSpotView(spotId) : false;
      const fetched = await fetchSpotCounts(spotId).catch(() => null);
      if (!live || !fetched) return;
      // The new view may not be readable yet; show it anyway.
      setState({ spotId, counts: counted ? { ...fetched, views: Math.max(fetched.views, 1) } : fetched });
    })();
    return () => {
      live = false;
    };
  }, [spotId, approved, uid]);
  const counts = state && state.spotId === spotId ? state.counts : null;
  const bumpVisit = () => setState((s) => (s ? { ...s, counts: { ...s.counts, visits: s.counts.visits + 1 } } : s));
  return { counts, bumpVisit };
}
