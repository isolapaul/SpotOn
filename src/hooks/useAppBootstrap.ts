import { useEffect, useState } from 'react';
import { useUserStore } from '@/store/useUserStore';
import { useSpotStore } from '@/store/useSpotStore';
import { DELAYS } from '@/lib/constants';

/**
 * Loading orchestration (moved out of page.tsx in T29): starts the auth listener and the spots
 * listener, and reports the app ready DELAYS.appReady ms after auth, spots (+ DELAYS.spotsSettle)
 * and the map (onMapLoad) are all loaded. Stops the spots listener on unmount (T21, BUG-01).
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

    // Fetch spots
    const initializeSpots = async () => {
      await useSpotStore.getState().fetchSpots();
      if (cancelled) return;
      // Wait a bit to ensure spots are populated
      spotsTimer = setTimeout(() => {
        setLoadingStates(prev => ({ ...prev, spots: true }));
      }, DELAYS.spotsSettle);
    };

    // Start both initializations in parallel
    initializeAuth();
    initializeSpots();

    // Cleanup
    return () => {
      cancelled = true;
      clearTimeout(spotsTimer);
      // Clean up spots listener: read it at cleanup time (the render-time value is always null)
      const unsub = useSpotStore.getState().unsubscribeSpots;
      if (unsub) {
        unsub();
        useSpotStore.setState({ unsubscribeSpots: null });
      }
    };
  }, []);

  // A new function each render, as before T29 (MapView's ready notifier re-arms on a new identity).
  const onMapLoad = () => {
    setLoadingStates(prev => ({ ...prev, map: true }));
  };

  return { isAppReady, onMapLoad };
}
