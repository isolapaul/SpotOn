import { useMemo } from 'react';
import { useSpotStore } from '@/store/useSpotStore';
import { useIsAdmin } from '@/hooks/useIsAdmin';

/** Spots shown on the map: admins see all spots, everyone else only approved ones. */
export function useVisibleSpots() {
  const spots = useSpotStore((s) => s.spots);
  const userIsAdmin = useIsAdmin();
  return useMemo(
    () => (userIsAdmin ? spots : spots.filter((spot) => spot.status === 'approved')),
    [spots, userIsAdmin],
  );
}
