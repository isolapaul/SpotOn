'use client';

import { useT } from '@/hooks/useT';
import { useEffect, useMemo, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { Spot } from '@/store/useSpotStore';
import { useMapThemeStore } from '@/store/useMapThemeStore';
import { useCategoryStore } from '@/store/useCategoryStore';
import { styleFor } from '@/lib/mapStyles';
import { DELAYS, Z } from '@/lib/constants';
import { MAPBOX_TOKEN, useMapInstance } from '@/hooks/map/useMapInstance';
import { useLocationPanner, useSpotFocuser } from '@/hooks/map/useMapCamera';
import { DRAFT_PIN_HTML, htmlElement, PIN_OFFSET, usePointMarker, USER_PUCK_HTML } from '@/hooks/map/usePointMarker';
import { useClusterMarkers, useClusters, useMapView, useMinuteClock } from '@/hooks/map/useClusters';
import { useSpotMarkers } from '@/hooks/map/useSpotMarkers';

interface MapViewProps {
  isAddingSpot?: boolean;
  onLocationSelect?: (location: { lat: number; lng: number }) => void;
  tempMarker?: { lat: number; lng: number } | null;
  spots?: Spot[];
  /** Blue dot and one-time pan target (page: the shared location, or the default centre once denied). */
  userLocation?: { lat: number; lng: number } | null;
  /** Bumped by the locate button: re-centre on userLocation (design 1C). */
  locateRequest?: number;
  /** The spot whose place card is open: its pin grows (design 1E). */
  selectedSpotId?: string | null;
  /** A pin tap: opens the place card. */
  onSpotPreview?: (spotId: string) => void;
  onMapLoad?: () => void;
  onMapClick?: () => void;
  /** Fly to this spot (opened from the profile); each request has a new `seq`. */
  focusRequest?: { spotId: string; seq: number } | null;
  /** The map reached the focused spot. */
  onSpotArrive?: (spotId: string) => void;
  /** Growth plan §5: locked places keep their pin, dimmed and without their name. */
  lockedIds?: ReadonlySet<string>;
}

export default function MapView({
  isAddingSpot = false,
  onLocationSelect,
  tempMarker,
  spots = [],
  userLocation = null,
  locateRequest = 0,
  selectedSpotId = null,
  onSpotPreview,
  onMapLoad,
  onMapClick,
  focusRequest = null,
  onSpotArrive,
  lockedIds,
}: Readonly<MapViewProps>) {
  const theme = useMapThemeStore((s) => s.theme);
  const t = useT();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  // The latest callbacks and mode, for the map's own event listeners (bound once).
  const latest = useRef({ isAddingSpot, onLocationSelect, onMapClick, onSpotPreview, onSpotArrive });
  useEffect(() => {
    latest.current = { isAddingSpot, onLocationSelect, onMapClick, onSpotPreview, onSpotArrive };
  });
  // Icons of the super admin's categories (item 7), by category id.
  const customCategories = useCategoryStore((s) => s.categories);
  const customIcons = useMemo(() => new Map(customCategories.map((c) => [c.id, c.icon])), [customCategories]);
  // The theme the current map shows (set when a map is created with the theme of that moment).
  const appliedThemeRef = useRef(theme);
  const themeRef = useRef(theme);
  useEffect(() => {
    themeRef.current = theme;
  });
  const { map, failed } = useMapInstance(containerRef, mapRef, themeRef, appliedThemeRef, latest);

  // The theme: swap the style in place (HTML markers stay).
  useEffect(() => {
    if (!map || appliedThemeRef.current === theme) return;
    appliedThemeRef.current = theme;
    map.setStyle(styleFor(theme, MAPBOX_TOKEN));
  }, [map, theme]);

  // Fires onMapLoad once shortly after mount (as before; it never waits for the style or tiles, so a
  // blocked or offline map never holds up the loading screen).
  const notified = useRef(false);
  useEffect(() => {
    if (notified.current || !onMapLoad) return;
    const timer = setTimeout(() => {
      notified.current = true;
      onMapLoad();
    }, DELAYS.mapReady);
    return () => clearTimeout(timer);
  }, [onMapLoad]);

  useLocationPanner(map, userLocation, locateRequest);
  useSpotFocuser(map, focusRequest, spots, latest);
  usePointMarker(map, userLocation, () => new mapboxgl.Marker({ element: htmlElement('user-puck-marker', USER_PUCK_HTML), anchor: 'center' }));
  usePointMarker(map, tempMarker, () =>
    new mapboxgl.Marker({ element: htmlElement('draft-pin-marker', DRAFT_PIN_HTML), anchor: 'top-left', offset: PIN_OFFSET }));

  // Clusters: nearby pins merge when zoomed out. Highlighted and selected pins always stay pins.
  const nowIso = useMinuteClock();
  const view = useMapView(map);
  const { shownSpots, clusters, index } = useClusters(spots, view, selectedSpotId, nowIso);
  useClusterMarkers(map, clusters, index, (count) => t('clusterLabel', { count }));

  // Spot markers: kept by id; only a changed look rebuilds a pin's markup, only a move re-positions it.
  useSpotMarkers(map, shownSpots, customIcons, selectedSpotId, nowIso, lockedIds, t, latest);

  // The container stays empty for Mapbox; the no-WebGL note is a sibling.
  return (
    <>
      <div ref={containerRef} className={`absolute inset-0 w-full h-full ${Z.mapBase}`} data-map-provider="mapbox" data-map-style={theme} />
      {failed && (
        <p role="status" className={`absolute inset-x-6 top-1/3 text-center text-label-secondary text-[15px] ${Z.mapBase}`}>
          {t('mapUnavailable')}
        </p>
      )}
    </>
  );
}
