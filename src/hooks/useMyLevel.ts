import { useMemo } from 'react';
import { useSpotStore } from '@/store/useSpotStore';
import { useUserStore } from '@/store/useUserStore';
import { getLevelInfo, getLevelProgress, type LevelInfo } from '@/lib/levelUtils';

/**
 * The signed-in user's level from their own spots (pending too, D8: the same count ProfilePanel
 * uses); null when signed out. The store already holds all own spots (own/admin listener, T30);
 * `loaded` is false until they are all in (before that the count misses the pending ones).
 */
export function useMyLevel(): { count: number; info: LevelInfo; progress: number; loaded: boolean } | null {
  const uid = useUserStore((s) => s.user?.uid);
  const spots = useSpotStore((s) => s.spots);
  const ownLoadedFor = useSpotStore((s) => s.ownLoadedFor);
  return useMemo(() => {
    if (!uid) return null;
    const count = spots.filter((spot) => spot.createdBy === uid).length;
    return { count, info: getLevelInfo(count), progress: getLevelProgress(count), loaded: ownLoadedFor === uid };
  }, [uid, spots, ownLoadedFor]);
}
