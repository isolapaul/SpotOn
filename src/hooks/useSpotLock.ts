import { useCallback, useMemo } from 'react';
import type { Spot } from '@/store/useSpotStore';
import { useSpotStore } from '@/store/useSpotStore';
import { useUserStore } from '@/store/useUserStore';
import { useFollowStore } from '@/store/useFollowStore';
import { useMyLevelStore } from '@/store/useMyLevelStore';
import { useUiStore } from '@/store/useUiStore';
import { useAppConfigStore } from '@/store/useAppConfigStore';
import { useIsAdmin } from './useIsAdmin';
import { nativePlatform } from '@/lib/nativeApp';
import { mostPopularIds } from '@/lib/popularity';
import { hasContributed, isSpotLocked, type LockContext } from '@/lib/spotLock';

/** Locked pins (growth plan §5): whether a spot is locked for this user right now. */
export function useSpotLock() {
  const enabled = useAppConfigStore((s) => s.config.lockEnabled);
  // The most popular places stay open for everyone (a good first look at the map).
  const openCount = useAppConfigStore((s) => s.config.lockOpenCount);
  const uid = useUserStore((s) => s.user?.uid ?? null);
  const isAdmin = useIsAdmin();
  const spots = useSpotStore((s) => s.spots);
  const following = useFollowStore((s) => s.following);
  const invites = useMyLevelStore((s) => s.invites);
  const linkedIds = useUiStore((s) => s.linkedSpotIds);

  const ctx = useMemo<LockContext>(() => {
    const ownSpots = uid ? spots.filter((s) => s.createdBy === uid).length : 0;
    return {
      enabled,
      uid,
      isAdmin,
      contributed: hasContributed({ ownSpots, invites, ios: nativePlatform() === 'ios' }),
      following,
      popular: enabled ? mostPopularIds(spots.filter((s) => s.status === 'approved'), openCount) : new Set(),
      linked: new Set(linkedIds),
    };
  }, [enabled, openCount, uid, isAdmin, spots, following, invites, linkedIds]);

  const isLocked = useCallback((spot: Pick<Spot, 'id' | 'status' | 'createdBy'>) => isSpotLocked(spot, ctx), [ctx]);
  return { enabled: enabled && !ctx.contributed && !isAdmin, isLocked };
}
