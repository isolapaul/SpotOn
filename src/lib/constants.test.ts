import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  DELAYS,
  DISCOVERY_BATCH_SIZE,
  FEEDBACK_MAX_FILES,
  GEOLOCATION_TIMEOUT_MS,
  INITIAL_MARKER_ZOOM,
  LOCATE_ZOOM,
  LOCATION_CACHE_MAX_AGE_MS,
  MAX_SPOT_IMAGES,
  MAX_UPLOAD_BYTES,
  SWIPE_THRESHOLDS,
  Z,
} from './constants';
import { FEEDBACK_LIMITS } from './feedback/validate';

describe('constants', () => {
  it('pins the per-spot image limit (D12)', () => {
    expect(MAX_SPOT_IMAGES).toBe(20);
  });

  it('pins the values the call sites used before T23', () => {
    expect(MAX_UPLOAD_BYTES).toBe(5 * 1024 * 1024);
    expect(FEEDBACK_MAX_FILES).toBe(FEEDBACK_LIMITS.maxAttachments);
    expect(FEEDBACK_MAX_FILES).toBe(3);
    expect(SWIPE_THRESHOLDS).toEqual({ panel: 150, spotDetails: 100, gallery: 50 });
    expect(DEFAULT_MAP_CENTER).toEqual([47.4979, 19.0402]);
    expect(DEFAULT_MAP_ZOOM).toBe(6);
    expect(LOCATE_ZOOM).toBe(13);
    expect(LOCATION_CACHE_MAX_AGE_MS).toBe(10 * 60 * 1000);
    expect(GEOLOCATION_TIMEOUT_MS).toBe(10000);
    expect(DISCOVERY_BATCH_SIZE).toBe(20);
    expect(DELAYS).toEqual({
      mapReady: 100,
      spotsSettle: 300,
      languageSelector: 300,
      heroClickGuard: 300,
      appReady: 500,
      approveClose: 1000,
      notificationPrompt: 3000,
    });
  });

  it('keeps the initial marker zoom at 13, independent of the map zoom', () => {
    expect(INITIAL_MARKER_ZOOM).toBe(13);
    expect(INITIAL_MARKER_ZOOM).not.toBe(DEFAULT_MAP_ZOOM);
  });
});

describe('Z scale', () => {
  const numeric = (cls: string): number => {
    const match = /^z-(?:\[(\d+)\]|(\d+))$/.exec(cls);
    if (!match) throw new Error(`not a z-index class: ${cls}`);
    return Number(match[1] ?? match[2]);
  };

  it('uses static Tailwind z-index classes', () => {
    for (const cls of Object.values(Z)) expect(() => numeric(cls)).not.toThrow();
  });

  it('is non-decreasing in listed order, except mapInner (inside the map stacking context)', () => {
    const values = Object.entries(Z)
      .filter(([name]) => name !== 'mapInner')
      .map(([, cls]) => numeric(cls));
    for (let i = 1; i < values.length; i++) expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
  });

  it('pins the values in use', () => {
    expect(Z).toEqual({
      mapOverlay: 'z-10', mapInner: 'z-[1000]', dock: 'z-50', prompt: 'z-50', panel: 'z-[60]',
      panelModal: 'z-[70]', gallery: 'z-[100]', floatingButton: 'z-[1500]', modal: 'z-[2000]',
      usernameSetup: 'z-[3500]', blocking: 'z-[9999]',
    });
  });
});
