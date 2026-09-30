import { useEffect, useState } from 'react';
import { useUserStore } from '@/store/useUserStore';
import { useSpotStore, type SpotScope } from '@/store/useSpotStore';
import { useModerationStore } from '@/store/useModerationStore';
import { useInboxStore } from '@/store/useInboxStore';
import { useMyLevelStore } from '@/store/useMyLevelStore';
import { useCategoryStore } from '@/store/useCategoryStore';
import { useFollowStore } from '@/store/useFollowStore';
import { DELAYS } from '@/lib/constants';

/**
 * The spots listeners' scope for a user-store state (T30). A persisted user counts only once auth
 * has confirmed it (`loading` false), so a stale cached uid never starts a query.
 */
function spotScopeOf(state: { user: { uid: string } | null; loading: boolean; isAdmin: boolean }): SpotScope {
  const uid = !state.loading && state.user ? state.user.uid : null;
  return { uid, isAdmin: uid !== null && state.isAdmin };
}

/**
 * Every per-user listener follows the same scope: spots (T30), moderation and the inbox (item 4),
 * the own level (item 5), incoming follow requests (item 8).
 */
function syncScopes(scope: SpotScope) {
  useSpotStore.getState().syncSpotScopes(scope);
  useModerationStore.getState().sync(scope);
  useInboxStore.getState().sync(scope.uid);
  useMyLevelStore.getState().sync(scope.uid);
  useFollowStore.getState().sync(scope.uid);
}

/**
 * Waits for the approved spots, never failing: if their listener errors before the first snapshot
 * (a missing or building index, permission-denied), the store keeps the error (`error`) and this
 * logs it and resolves, so the app still renders (a map without spots) instead of an endless
 * loading screen.
 */
export async function settleApprovedSpots(start: () => Promise<void>): Promise<void> {
  try {
    await start();
  } catch (error) {
    console.error('Approved spots failed to load; continuing without them:', error);
  }
}

/**
 * Loading orchestration (moved out of page.tsx in T29): starts the auth listener and the spots
 * listeners, and reports the app ready DELAYS.appReady ms after auth, approved spots
 * (+ DELAYS.spotsSettle) and the map (onMapLoad) are all loaded. The own/admin spots listeners
 * follow sign-in, sign-out and admin status (T30). Stops all spots listeners on unmount (T21, BUG-01).
 */
export function useAppBootstrap(): { isAppReady: boolean; onMapLoad: () => void } {
  const [isAppReady, setIsAppReady] = useState(false);
  const [loadingStates, setLoadingStates] = useState({
    auth: false,
    spots: false,
    map: false,
  });

  // Check if all resources are loaded
  useEffect(() => {
    const allLoaded = loadingStates.auth && loadingStates.spots && loadingStates.map;
    if (allLoaded && !isAppReady) {
      // Small delay for smooth transition
      const id = setTimeout(() => {
        setIsAppReady(true);
      }, DELAYS.appReady);
      return () => clearTimeout(id);
    }
  }, [loadingStates, isAppReady]);

  useEffect(() => {
    let spotsTimer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    // Initialize Firebase auth listener
    const initializeAuth = async () => {
      await useUserStore.getState().initAuth();
      setLoadingStates(prev => ({ ...prev, auth: true }));
    };

    // Approved spots gate the loading screen; anonymous visitors never wait for auth (T30).
    // A failed approved listener also opens the gate (settleApprovedSpots).
    const initializeSpots = async () => {
      await settleApprovedSpots(() => useSpotStore.getState().startSpots());
      if (cancelled) return;
      // Wait a bit to ensure spots are populated
      spotsTimer = setTimeout(() => {
        setLoadingStates(prev => ({ ...prev, spots: true }));
      }, DELAYS.spotsSettle);
    };

    // Own/admin spots follow the signed-in user and admin status, synchronously on every change,
    // so another user's (or a signed-out user's) pending spots are dropped at once (T30).
    let scope = spotScopeOf(useUserStore.getState());
    const unsubscribeUser = useUserStore.subscribe((state) => {
      const next = spotScopeOf(state);
      if (next.uid === scope.uid && next.isAdmin === scope.isAdmin) return;
      scope = next;
      syncScopes(scope);
    });

    // Start both initializations in parallel; the super admin's categories are public (item 7).
    initializeAuth();
    initializeSpots();
    useCategoryStore.getState().start();
    syncScopes(scope);

    // Cleanup
    return () => {
      cancelled = true;
      clearTimeout(spotsTimer);
      unsubscribeUser();
      // Clean up all spots listeners (read from the store at cleanup time)
      useSpotStore.getState().stopSpots();
      useCategoryStore.getState().stop();
      syncScopes({ uid: null, isAdmin: false });
    };
  }, []);

  // A new function each render, as before T29 (MapView's ready notifier re-arms on a new identity).
  const onMapLoad = () => {
    setLoadingStates(prev => ({ ...prev, map: true }));
  };

  return { isAppReady, onMapLoad };
}
