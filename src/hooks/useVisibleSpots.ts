import { useMemo } from 'react';
import { useSpotStore } from '@/store/useSpotStore';
import { useUserStore } from '@/store/useUserStore';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { isVisibleOnMap } from '@/lib/spotStatus';

/** Spots shown on the map: admins see all spots, everyone else approved ones plus their own. */
export function useVisibleSpots() {
  const spots = useSpotStore((s) => s.spots);
  const uid = useUserStore((s) => s.user?.uid);
  const userIsAdmin = useIsAdmin();
  return useMemo(
    () => spots.filter((spot) => isVisibleOnMap(spot, uid, userIsAdmin)),
    [spots, uid, userIsAdmin],
  );
}
