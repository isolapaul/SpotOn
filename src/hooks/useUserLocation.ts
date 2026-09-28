import { useEffect } from 'react';
import { useLocationStore } from '@/store/useLocationStore';

/**
 * The user's location from the shared location store (T29, DUP-14). The first mount starts the one
 * automatic request (in an effect: navigator and sessionStorage do not exist during SSR).
 * `location` is null until granted and on error; `request` is the manual request (SettingsPanel).
 */
export function useUserLocation() {
  const location = useLocationStore((s) => s.location);
  const status = useLocationStore((s) => s.status);
  const request = useLocationStore((s) => s.request);

  useEffect(() => {
    useLocationStore.getState().requestAutomatic();
  }, []);

  return { location, status, request };
}
