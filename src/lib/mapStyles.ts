// Map styles per theme (Mapbox GL JS). Pure.
import type { StyleSpecification } from 'mapbox-gl';
import type { MapTheme } from '@/store/useMapThemeStore';

/** The Mapbox style of each theme (the same five looks the app had with raster tiles). */
export const MAPBOX_STYLES: Readonly<Record<MapTheme, string>> = {
  standard: 'mapbox://styles/mapbox/streets-v12',
  light: 'mapbox://styles/mapbox/light-v11',
  silver: 'mapbox://styles/mapbox/navigation-day-v1',
  dark: 'mapbox://styles/mapbox/dark-v11',
  satellite: 'mapbox://styles/mapbox/satellite-v9',
};

/** The page background per theme (globals.css --map-bg), used by the offline style. */
const BACKGROUNDS: Readonly<Record<MapTheme, string>> = {
  standard: '#f2efe9',
  light: '#fafaf8',
  silver: '#f3f1ec',
  dark: '#1b1c1e',
  satellite: '#1f2a1d',
};

/**
 * The style for a theme: the Mapbox style with a token, else a plain background in the theme's
 * colour (local builds and the e2e tests have no token, and must not call Mapbox).
 */
export function styleFor(theme: MapTheme, token: string | undefined): string | StyleSpecification {
  if (token?.trim()) return MAPBOX_STYLES[theme] ?? MAPBOX_STYLES.standard;
  return {
    version: 8,
    name: `offline-${theme}`,
    sources: {},
    layers: [{ id: 'background', type: 'background', paint: { 'background-color': BACKGROUNDS[theme] ?? BACKGROUNDS.standard } }],
  };
}
