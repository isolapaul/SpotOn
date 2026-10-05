// App-wide constants (T21, extended in T23). Single definitions live next to their helpers
// and are re-exported here. Pure: no React, Firebase or DOM.
import { FEEDBACK_LIMITS } from './feedback/validate';

export { MAX_SPOT_IMAGES } from './spotImages';

/** Client-side size cap for a picked image before compression (AddSpotModal, SettingsPanel). */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/** Maximum feedback attachments (the server limit, T14). */
export const FEEDBACK_MAX_FILES = FEEDBACK_LIMITS.maxAttachments;

/** Horizontal swipe distance (px) that triggers the gesture. */
export const SWIPE_THRESHOLDS = { panel: 150, spotDetails: 100, gallery: 50 } as const;

/**
 * Map defaults (Budapest). Zooms are Mapbox GL zooms (512px tiles): one less than the Leaflet
 * zoom of the same scale the app used before.
 */
export const DEFAULT_MAP_CENTER: [number, number] = [47.4979, 19.0402];
export const DEFAULT_MAP_ZOOM = 5;
/** The closest zoom: Mapbox 17 is the scale of Leaflet's 18, the closest the map went before. */
export const MAX_MAP_ZOOM = 17;
/** Zoom used when panning to the user's location. */
export const LOCATE_ZOOM = 12;
/**
 * Flying to a spot opened from the profile: at least this zoom (pins, not dots), this long, with the
 * spot this many px above the centre so the place card does not cover it; a fallback in case the map
 * never reports the end of the move.
 */
export const SPOT_FOCUS = { zoom: 15, durationS: 0.9, liftPx: 110, fallbackMs: 1600 } as const;
/** Cached user location max age (sessionStorage and geolocation maximumAge). */
export const LOCATION_CACHE_MAX_AGE_MS = 600_000;
export const GEOLOCATION_TIMEOUT_MS = 10_000;

/** How long a fetched publicProfiles/{uid} document is reused before it is read again (T26). */
export const PUBLIC_PROFILE_TTL_MS = 5 * 60_000;

/**
 * Deadline for one network step of a background upload (one photo, the spot write, the callable,
 * the review write) before the user gets an error with Retry instead of a stuck state (G4, #8).
 */
export const UPLOAD_TIMEOUT_MS = 60_000;

/** Spots per "load more" batch in the discovery panel. */
export const DISCOVERY_BATCH_SIZE = 20;

/** UI timer delays in ms. */
export const DELAYS = {
  /** MapView: onMapLoad after the map is ready. */
  mapReady: 100,
  /** page.tsx: after the spots listener delivered, before marking spots loaded. */
  spotsSettle: 300,
  /** SpotDetailsPanel: ignore hero clicks right after opening. */
  heroClickGuard: 300,
  /** page.tsx: all resources loaded → app ready. */
  appReady: 500,
  /** SpotDetailsPanel: close after approving. */
  approveClose: 1000,
  /** UploadStatus: how long the "uploaded" pill stays. */
  uploadDoneVisible: 2500,
} as const;

/**
 * Z-index scale (Tailwind classes, static strings; applied in T25). Listed in ascending order,
 * except the nested layers (NESTED_Z_LAYERS), which live inside another layer's stacking context
 * and are therefore not comparable with the rest:
 * - `mapInner` sits inside the map container's `mapBase` (`z-0`) context.
 * - `panelInnerBackdrop` / `panelInnerSheet` (SettingsPanel) are rendered inside ProfilePanel's
 *   `panel` (`z-60`) root, so they stack above the profile content although 40/50 < 60 (BUG-22).
 * `onboarding` (the first-run tour) covers the map chrome and stays below the sign-in sheet it opens.
 */
export const Z = {
  mapBase: 'z-0', mapOverlay: 'z-10', mapInner: 'z-1000', dock: 'z-50', prompt: 'z-50', placeCard: 'z-55',
  panel: 'z-60', panelInnerBackdrop: 'z-40', panelInnerSheet: 'z-50', panelModal: 'z-70',
  gallery: 'z-100', floatingButton: 'z-1500', onboarding: 'z-1900', modal: 'z-2000', usernameSetup: 'z-3500',
  blocking: 'z-9999',
} as const;

/** Z keys that live inside another layer's stacking context (see Z). */
export const NESTED_Z_LAYERS: ReadonlyArray<keyof typeof Z> = ['mapInner', 'panelInnerBackdrop', 'panelInnerSheet'];
