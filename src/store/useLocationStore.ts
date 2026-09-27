import { create } from 'zustand';
import { GEOLOCATION_TIMEOUT_MS, LOCATION_CACHE_MAX_AGE_MS } from '@/lib/constants';

export interface LatLng {
  lat: number;
  lng: number;
}

export type LocationStatus = 'idle' | 'pending' | 'granted' | 'denied';
export type RequestResult = 'granted' | 'denied' | 'unsupported';

interface LocationStore {
  status: LocationStatus;
  location: LatLng | null;
  /** Dedupe flag for the automatic request (status stays 'idle' when geolocation is unsupported). */
  autoRequested: boolean;
  /** The one automatic request at startup; no-op once made. */
  requestAutomatic: () => void;
  /** Manual request (SettingsPanel). Writes the store only on success. */
  request: () => Promise<RequestResult>;
}

// sessionStorage cache shared with earlier builds (same keys as the pre-T29 MapView cache).
const CACHE_KEY = 'userLocation';
const CACHE_TIME_KEY = 'userLocationTime';

function readCache(): LatLng | null {
  const cachedLocation = sessionStorage.getItem(CACHE_KEY);
  const cachedTime = sessionStorage.getItem(CACHE_TIME_KEY);
  if (!cachedLocation || !cachedTime) return null;
  const age = Date.now() - Number.parseInt(cachedTime, 10);
  return age < LOCATION_CACHE_MAX_AGE_MS ? (JSON.parse(cachedLocation) as LatLng) : null;
}

function writeCache(loc: LatLng) {
  sessionStorage.setItem(CACHE_KEY, JSON.stringify(loc));
  sessionStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
}

function toLatLng(position: GeolocationPosition): LatLng {
  return { lat: position.coords.latitude, lng: position.coords.longitude };
}

/** Single source of the user's location (T29, DUP-14). Read it through useUserLocation(). */
export const useLocationStore = create<LocationStore>((set, get) => ({
  status: 'idle',
  location: null,
  autoRequested: false,

  requestAutomatic: () => {
    if (get().autoRequested) return;
    set({ autoRequested: true });
    const geo = globalThis.navigator?.geolocation;
    if (!geo) return;

    const cached = readCache();
    if (cached) {
      set({ location: cached, status: 'granted' });
      return;
    }

    set({ status: 'pending' });
    geo.getCurrentPosition(
      (position) => {
        const loc = toLatLng(position);
        writeCache(loc);
        set({ location: loc, status: 'granted' });
      },
      () => {
        // A manual success in between wins.
        if (get().status === 'pending') set({ status: 'denied', location: null });
      },
      { enableHighAccuracy: false, timeout: GEOLOCATION_TIMEOUT_MS, maximumAge: LOCATION_CACHE_MAX_AGE_MS },
    );
  },

  request: () =>
    new Promise<RequestResult>((resolve) => {
      const geo = globalThis.navigator?.geolocation;
      if (!geo) {
        resolve('unsupported');
        return;
      }
      geo.getCurrentPosition(
        (position) => {
          const loc = toLatLng(position);
          writeCache(loc);
          set({ location: loc, status: 'granted' });
          resolve('granted');
        },
        () => resolve('denied'),
        { enableHighAccuracy: true, timeout: GEOLOCATION_TIMEOUT_MS },
      );
    }),
}));

export default useLocationStore;
