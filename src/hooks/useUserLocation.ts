import { useEffect } from 'react';
import { useLocationStore } from '@/store/useLocationStore';
import { useOnboardingStore, selectTourBlocking } from '@/store/useOnboardingStore';
import { shouldAutoRequestLocation } from '@/lib/onboarding';

/**
 * The user's location from the shared location store (T29, DUP-14). The first mount starts the one
 * automatic request (in an effect: navigator and sessionStorage do not exist during SSR), except
 * while the first-run tour is due or open (its location step asks instead) and, after "not now" in
 * the tour, for the rest of the session.
 * `location` is null until granted and on error; `request` is the manual request (SettingsPanel).
 */
export function useUserLocation() {
  const location = useLocationStore((s) => s.location);
  const status = useLocationStore((s) => s.status);
  const request = useLocationStore((s) => s.request);
  const autoAllowed = useOnboardingStore((s) =>
    shouldAutoRequestLocation({ tourBlocking: selectTourBlocking(s), choice: s.locationChoice }),
  );

  useEffect(() => {
    if (autoAllowed) useLocationStore.getState().requestAutomatic();
  }, [autoAllowed]);

  return { location, status, request };
}
