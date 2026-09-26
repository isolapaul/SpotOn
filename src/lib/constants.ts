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

/** Map defaults (Budapest). */
export const DEFAULT_MAP_CENTER: [number, number] = [47.4979, 19.0402];
export const DEFAULT_MAP_ZOOM = 6;
/** Zoom used when panning to the user's location. */
export const LOCATE_ZOOM = 13;
/**
 * MapView's initial `zoomLevel` state: drives marker size until the first zoom event. It is 13
 * although the map opens at DEFAULT_MAP_ZOOM; keep it separate (changing it changes marker sizes).
 */
export const INITIAL_MARKER_ZOOM = 13;
/** Cached user location max age (sessionStorage and geolocation maximumAge). */
export const LOCATION_CACHE_MAX_AGE_MS = 600_000;
export const GEOLOCATION_TIMEOUT_MS = 10_000;

/** Spots per "load more" batch in the discovery panel. */
export const DISCOVERY_BATCH_SIZE = 20;

/** UI timer delays in ms. */
export const DELAYS = {
  /** MapView: onMapLoad after the map is ready. */
  mapReady: 100,
  /** page.tsx: after the spots listener delivered, before marking spots loaded. */
  spotsSettle: 300,
  /** LanguageSelector entrance. */
  languageSelector: 300,
  /** SpotDetailsPanel: ignore hero clicks right after opening. */
  heroClickGuard: 300,
  /** page.tsx: all resources loaded → app ready. */
  appReady: 500,
  /** SpotDetailsPanel: close after approving. */
  approveClose: 1000,
  /** NotificationPrompt: show the prompt after sign-in. */
  notificationPrompt: 3000,
} as const;

/**
 * Z-index scale (Tailwind classes, static strings; applied in T25). Listed in ascending order;
 * `mapInner` lives inside the map container's `z-0` stacking context, so it is not comparable.
 */
export const Z = {
  mapOverlay: 'z-10', mapInner: 'z-[1000]', dock: 'z-50', prompt: 'z-50', panel: 'z-[60]',
  panelModal: 'z-[70]', gallery: 'z-[100]', floatingButton: 'z-[1500]', modal: 'z-[2000]',
  usernameSetup: 'z-[3500]', blocking: 'z-[9999]',
} as const;
