import { useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { styleFor } from '@/lib/mapStyles';
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM, MAX_MAP_ZOOM } from '@/lib/constants';

// Build-time, public: a Mapbox access token restricted to the app's URL. Without it the map is a
// plain background in the theme's colour (local builds, e2e), and Mapbox is never called.
// The apps have their own token (NEXT_PUBLIC_MAPBOX_TOKEN_APP): the web token is restricted to the
// site's URL, and the bundled app runs on a local origin.
export const MAPBOX_TOKEN = (process.env.NEXT_PUBLIC_APP_BUILD === '1' && process.env.NEXT_PUBLIC_MAPBOX_TOKEN_APP?.trim())
  || process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim() || undefined;

/** The latest callbacks and mode, for the map's own event listeners (bound once). */
export type Latest = React.RefObject<{
  isAddingSpot: boolean;
  onLocationSelect?: (loc: { lat: number; lng: number }) => void;
  onMapClick?: () => void;
  onSpotPreview?: (spotId: string) => void;
  onSpotArrive?: (spotId: string) => void;
}>;

export type Theme = Parameters<typeof styleFor>[0];

/**
 * Creates the Mapbox map once (2D like before: flat Mercator, no rotation or pitch) and removes it
 * on unmount. Map clicks place a new spot while picking, else close the place card. Without WebGL
 * (some in-app browsers, hardware acceleration off) there is no map: `failed`, the rest of the app
 * works. A rejected token or style falls back to the offline background style once.
 */
export function useMapInstance(
  containerRef: React.RefObject<HTMLDivElement | null>,
  mapRef: React.RefObject<mapboxgl.Map | null>,
  themeRef: React.RefObject<Theme>,
  appliedThemeRef: React.RefObject<Theme>,
  latest: Latest,
): { map: mapboxgl.Map | null; failed: boolean } {
  const [state, setState] = useState<{ map: mapboxgl.Map | null; failed: boolean }>({ map: null, failed: false });
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (MAPBOX_TOKEN) mapboxgl.accessToken = MAPBOX_TOKEN;
    const theme = themeRef.current;
    let map: mapboxgl.Map;
    try {
      if (!mapboxgl.supported()) throw new Error('WebGL is not supported');
      map = new mapboxgl.Map({
        container,
        style: styleFor(theme, MAPBOX_TOKEN),
        // The hosted v11/v12 styles turn on the globe at low zoom; the map stays flat as before.
        projection: 'mercator',
        center: [DEFAULT_MAP_CENTER[1], DEFAULT_MAP_CENTER[0]],
        zoom: DEFAULT_MAP_ZOOM,
        maxZoom: MAX_MAP_ZOOM,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        attributionControl: false,
        logoPosition: 'bottom-left',
        // Only the map-load count the privacy policy describes, no performance telemetry.
        performanceMetricsCollection: false,
      });
    } catch (error) {
      // Reported from the next microtask: the failure comes from outside React (WebGL).
      console.error('Map unavailable:', error);
      let live = true;
      queueMicrotask(() => {
        if (live) setState({ map: null, failed: true });
      });
      return () => {
        live = false;
      };
    }
    appliedThemeRef.current = theme;
    let fellBack = false;
    map.on('error', (e) => {
      const status = (e.error as { status?: number } | undefined)?.status;
      console.error('Map error:', e.error);
      // A revoked or restricted token: the theme's background instead of an empty canvas.
      if (!fellBack && MAPBOX_TOKEN && (status === 401 || status === 403)) {
        fellBack = true;
        map.setStyle(styleFor(appliedThemeRef.current, undefined));
      }
    });
    map.touchZoomRotate.disableRotation();
    map.keyboard.disableRotation();
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right');
    map.on('click', (e) => {
      const target = e.originalEvent.target as Element | null;
      if (target?.closest?.('.spot-marker, .spot-cluster-marker')) return;
      const { isAddingSpot, onLocationSelect, onMapClick } = latest.current;
      if (isAddingSpot && onLocationSelect) onLocationSelect({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      else onMapClick?.();
    });
    mapRef.current = map;
    setState({ map, failed: false });
    return () => {
      mapRef.current = null;
      setState({ map: null, failed: false });
      map.remove();
    };
  }, [containerRef, mapRef, themeRef, appliedThemeRef, latest]);
  return state;
}
