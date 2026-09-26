import { useCallback } from 'react';
import { useUserStore } from '@/store/useUserStore';
import type { User } from '@/lib/mapUserDoc';

type FavoriteState = { user: Pick<User, 'savedSpots'> | null };

/** Whether `spotId` is in the signed-in user's savedSpots (store truth, BUG-09). */
export function selectIsFavorite(state: FavoriteState, spotId: string): boolean {
  return !!state.user?.savedSpots?.includes(spotId);
}

/** Only a signed-in user can toggle a favourite. */
export function selectCanToggle(state: FavoriteState): boolean {
  return !!state.user;
}

/** Runs the store toggle; failures are logged, not thrown (as the component handlers did). */
export async function runFavoriteToggle(
  toggleFavorite: (spotId: string) => Promise<void>,
  spotId: string,
  canToggle: boolean,
): Promise<void> {
  if (!canToggle) return;
  try {
    await toggleFavorite(spotId);
  } catch (error) {
    console.error('Failed to toggle favorite:', error);
  }
}

/**
 * Favourite state and toggle for one spot (T26). `isFavorite` is read from the store's
 * user.savedSpots, so it stays in sync everywhere instead of a local copy.
 */
export function useFavoriteToggle(spotId: string) {
  const isFavorite = useUserStore((s) => selectIsFavorite(s, spotId));
  const canToggle = useUserStore(selectCanToggle);
  const toggleFavorite = useUserStore((s) => s.toggleFavorite);
  const toggle = useCallback(
    () => runFavoriteToggle(toggleFavorite, spotId, canToggle),
    [toggleFavorite, spotId, canToggle],
  );
  return { isFavorite, toggle, canToggle };
}
