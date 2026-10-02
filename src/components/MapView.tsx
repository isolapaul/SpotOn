'use client';

import { useT } from '@/hooks/useT';
import { useEffect, useMemo, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { Spot } from '@/store/useSpotStore';
import { useMapThemeStore } from '@/store/useMapThemeStore';
import { useCategoryStore } from '@/store/useCategoryStore';
import { buildClusterHtml, buildPinHtml, CLUSTER_MAX_ZOOM, CLUSTER_RADIUS, markerVariant, PIN_ANCHOR } from '@/lib/mapMarkers';
import Supercluster, { type ClusterFeature } from 'supercluster';
import { styleFor } from '@/lib/mapStyles';
import { normalizePinIcon } from '@/lib/pinGlyphs';
import { normalizeCategory } from '@/lib/categoryGlyphs';
import {
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  DELAYS,
  LOCATE_ZOOM,
  MAX_MAP_ZOOM,
  SPOT_FOCUS,
  Z,
} from '@/lib/constants';

// Build-time, public: a Mapbox access token restricted to the app's URL. Without it the map is a
// plain background in the theme's colour (local builds, e2e), and Mapbox is never called.
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim() || undefined;

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
}

/** The pin's tip is the spot's coordinate (PIN_ANCHOR inside the 44×54 pin box). */
const PIN_OFFSET: [number, number] = [-PIN_ANCHOR[0], -PIN_ANCHOR[1]];

const USER_PUCK_HTML =
  '<span class="user-puck" aria-hidden="true"><span class="user-puck__halo"></span><span class="user-puck__dot"></span></span>';

// The location picked while adding a spot: a brand pin with a plus, dropped in once.
const DRAFT_PIN_HTML =
  '<div class="draft-pin" aria-hidden="true"><svg width="44" height="54" viewBox="0 0 44 54">' +
  '<ellipse cx="22" cy="50.6" rx="6" ry="2" fill="#000" opacity=".22"/>' +
  '<path d="M22 50C20.6 45.5 18 41.8 14.9 36.5A18 18 0 1 1 29.1 36.5C26 41.8 23.4 45.5 22 50Z" fill="#12814F" stroke="#fff" stroke-width="3"/>' +
  '<path d="M22 13v14M15 20h14" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/></svg></div>';

function htmlElement(className: string, html: string): HTMLDivElement {
  const el = document.createElement('div');
  el.className = className;
  el.innerHTML = html;
  return el;
}

/** One map marker at a point, created and removed with the value (the user dot, the draft pin). */
function usePointMarker(
  map: mapboxgl.Map | null,
  point: { lat: number; lng: number } | null | undefined,
  make: () => mapboxgl.Marker,
) {
  const marker = useRef<mapboxgl.Marker | null>(null);
  const has = !!point;
  useEffect(() => {
    if (!map || !has) return;
    marker.current = make().setLngLat([0, 0]).addTo(map);
    return () => {
      marker.current?.remove();
      marker.current = null;
    };
    // `make` is a constant factory.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, has]);
  useEffect(() => {
    if (point) marker.current?.setLngLat([point.lng, point.lat]);
  }, [point, map, has]);
}

interface SpotMarker {
  marker: mapboxgl.Marker;
  el: HTMLDivElement;
  /** The pin's look; the markup is rebuilt only when it changes. */
  key: string;
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
}: Readonly<MapViewProps>) {
  const theme = useMapThemeStore((s) => s.theme);
  const t = useT();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markers = useRef(new Map<string, SpotMarker>());
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
  useClusterMarkers(map, clusters, index);

  // Spot markers: kept by id; only a changed look rebuilds a pin's markup, only a move re-positions it.
  useEffect(() => {
    if (!map) return;
    const seen = new Set<string>();
    shownSpots.forEach((spot, index) => {
      seen.add(spot.id);
      const highlighted = (spot.highlighted || []).some((h) => h.expiresAt > nowIso);
      const look = {
        category: spot.category,
        categoryIcon: customIcons.get(spot.category) ?? null,
        variant: markerVariant(spot.status),
        highlighted,
        pin: normalizePinIcon(spot.ownerPin),
      };
      const key = `${normalizeCategory(look.category)}|${look.categoryIcon ?? ''}|${look.variant}|${highlighted ? 1 : 0}|${look.pin ?? ''}`;
      let entry = markers.current.get(spot.id);
      if (!entry) {
        const el = document.createElement('div');
        el.className = 'spot-marker';
        el.setAttribute('role', 'button');
        el.tabIndex = 0;
        // Pins land one after another (a short cascade, capped), not all at once.
        el.style.setProperty('--pin-delay', `${Math.min(index, 24) * 22}ms`);
        const open = (e: Event) => {
          e.stopPropagation();
          latest.current.onSpotPreview?.(spot.id);
        };
        el.addEventListener('click', open);
        el.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') open(e);
        });
        const marker = new mapboxgl.Marker({ element: el, anchor: 'top-left', offset: PIN_OFFSET })
          .setLngLat([spot.location.lng, spot.location.lat])
          .addTo(map);
        entry = { marker, el, key: '' };
        markers.current.set(spot.id, entry);
      } else {
        const at = entry.marker.getLngLat();
        if (at.lat !== spot.location.lat || at.lng !== spot.location.lng) {
          entry.marker.setLngLat([spot.location.lng, spot.location.lat]);
        }
      }
      if (entry.key !== key) {
        entry.el.innerHTML = buildPinHtml(look);
        entry.key = key;
      }
      entry.el.title = spot.name;
      entry.el.setAttribute('aria-label', spot.name);
      entry.el.style.zIndex = spot.id === selectedSpotId ? '3' : highlighted ? '2' : '1';
      const pin = entry.el.querySelector<HTMLElement>('.spot-pin');
      if (pin) {
        if (spot.id === selectedSpotId) pin.dataset.selected = 'true';
        else delete pin.dataset.selected;
      }
    });
    for (const [id, entry] of markers.current) {
      if (seen.has(id)) continue;
      entry.marker.remove();
      markers.current.delete(id);
    }
  }, [map, shownSpots, customIcons, selectedSpotId, nowIso]);

  // A map going away (unmount, or a rebuilt map): drop its markers, so the new map gets its own.
  useEffect(() => {
    if (!map) return;
    const all = markers.current;
    return () => {
      for (const entry of all.values()) entry.marker.remove();
      all.clear();
    };
  }, [map]);

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

/** The current time as an ISO string, refreshed every minute (highlight expiry; stable between renders). */
function useMinuteClock(): string {
  const [now, setNow] = useState(() => new Date().toISOString());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date().toISOString()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

type Latest = React.RefObject<{
  isAddingSpot: boolean;
  onLocationSelect?: (loc: { lat: number; lng: number }) => void;
  onMapClick?: () => void;
  onSpotPreview?: (spotId: string) => void;
  onSpotArrive?: (spotId: string) => void;
}>;

type Theme = Parameters<typeof styleFor>[0];

/**
 * Creates the Mapbox map once (2D like before: flat Mercator, no rotation or pitch) and removes it
 * on unmount. Map clicks place a new spot while picking, else close the place card. Without WebGL
 * (some in-app browsers, hardware acceleration off) there is no map: `failed`, the rest of the app
 * works. A rejected token or style falls back to the offline background style once.
 */
function useMapInstance(
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

function prefersReducedMotion(): boolean {
  return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

// Pans the map to the user's location once when it becomes available, and again (a smooth fly) on
// every locate request; a request made before the location is known is served when it arrives.
function useLocationPanner(map: mapboxgl.Map | null, userLocation: { lat: number; lng: number } | null, locateRequest: number) {
  const panned = useRef(false);
  const servedRequest = useRef(locateRequest);
  useEffect(() => {
    if (!map || !userLocation) return;
    const center: [number, number] = [userLocation.lng, userLocation.lat];
    if (!panned.current) {
      panned.current = true;
      servedRequest.current = locateRequest;
      map.easeTo({ center, zoom: LOCATE_ZOOM, animate: !prefersReducedMotion() });
    } else if (locateRequest !== servedRequest.current) {
      servedRequest.current = locateRequest;
      map.flyTo({ center, zoom: Math.max(map.getZoom(), LOCATE_ZOOM), duration: 800, essential: false });
    }
  }, [userLocation, locateRequest, map]);
}

// Flies to a focused spot (opened from the profile) and reports the arrival, once per request. The spot
// lands a little above the centre, clear of the place card; reduced motion jumps instead of flying.
function useSpotFocuser(
  map: mapboxgl.Map | null,
  focus: { spotId: string; seq: number } | null,
  spots: Spot[],
  latest: Latest,
) {
  const served = useRef(0);
  // Only the target matters: a spots snapshot during the flight must not restart or cancel it.
  const target = focus ? spots.find((s) => s.id === focus.spotId)?.location ?? null : null;
  const lat = target?.lat;
  const lng = target?.lng;

  useEffect(() => {
    if (!map || !focus || focus.seq === served.current || lat === undefined || lng === undefined) return;
    served.current = focus.seq;
    const zoom = Math.max(map.getZoom(), SPOT_FOCUS.zoom);
    let done = false;
    const arrive = () => {
      if (done) return;
      done = true;
      latest.current.onSpotArrive?.(focus.spotId);
    };
    if (prefersReducedMotion()) {
      map.jumpTo({ center: [lng, lat], zoom });
      map.panBy([0, SPOT_FOCUS.liftPx], { animate: false });
      arrive();
      return;
    }
    // flyTo first: it stops a running ease, which fires a moveend at once; only the flight's own
    // moveend means arrival.
    map.flyTo({ center: [lng, lat], zoom, offset: [0, -SPOT_FOCUS.liftPx], duration: SPOT_FOCUS.durationS * 1000, essential: true });
    map.once('moveend', arrive);
    const fallback = setTimeout(arrive, SPOT_FOCUS.fallbackMs);
    return () => {
      clearTimeout(fallback);
      map.off('moveend', arrive);
    };
  }, [focus, lat, lng, map, latest]);
}

interface MapViewState {
  zoom: number;
  bbox: [number, number, number, number];
}

/** The visible area and zoom, updated when a move ends (clusters are recomputed then). */
function useMapView(map: mapboxgl.Map | null): MapViewState | null {
  const [view, setView] = useState<MapViewState | null>(null);
  useEffect(() => {
    if (!map) return;
    const update = () => {
      const b = map.getBounds();
      if (!b) return;
      // A margin, so pins just outside the screen are ready when panning.
      const padLng = (b.getEast() - b.getWest()) * 0.25;
      const padLat = (b.getNorth() - b.getSouth()) * 0.25;
      setView({
        zoom: map.getZoom(),
        bbox: [b.getWest() - padLng, b.getSouth() - padLat, b.getEast() + padLng, b.getNorth() + padLat],
      });
    };
    update();
    map.on('moveend', update);
    map.on('resize', update);
    return () => {
      map.off('moveend', update);
      map.off('resize', update);
    };
  }, [map]);
  return view;
}

type ClusterProps = { pending: number };
type PointProps = { spotId: string; pending: number };
type ClusterIndex = Supercluster<PointProps, ClusterProps>;

/** Splits the spots into single pins and clusters for the current view. */
function useClusters(spots: Spot[], view: MapViewState | null, selectedSpotId: string | null, nowIso: string) {
  const index = useMemo(() => {
    const idx: ClusterIndex = new Supercluster<PointProps, ClusterProps>({
      radius: CLUSTER_RADIUS,
      maxZoom: CLUSTER_MAX_ZOOM,
      // Mapbox zooms with 512 px tiles.
      extent: 512,
      map: (p) => ({ pending: p.pending }),
      reduce: (acc, p) => {
        acc.pending += p.pending;
      },
    });
    idx.load(
      spots
        .filter((s) => !(s.highlighted || []).some((h) => h.expiresAt > nowIso) && s.id !== selectedSpotId)
        .map((s) => ({
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [s.location.lng, s.location.lat] },
          properties: { spotId: s.id, pending: s.status === 'approved' ? 0 : 1 },
        })),
    );
    return idx;
  }, [spots, selectedSpotId, nowIso]);

  return useMemo(() => {
    if (!view) return { shownSpots: spots, clusters: [], index };
    const features = index.getClusters(view.bbox, Math.floor(view.zoom));
    const single = new Set<string>();
    const clusters: ClusterFeature<ClusterProps>[] = [];
    for (const f of features) {
      if ('cluster' in f.properties && f.properties.cluster) clusters.push(f as ClusterFeature<ClusterProps>);
      else single.add((f.properties as PointProps).spotId);
    }
    const clustered = new Set<string>();
    for (const c of clusters) {
      for (const leaf of index.getLeaves(c.properties.cluster_id, Infinity)) clustered.add(leaf.properties.spotId);
    }
    // Pins outside the view stay (no flicker at the edges); clustered ones are hidden.
    return { shownSpots: spots.filter((s) => !clustered.has(s.id)), clusters, index };
  }, [spots, view, index]);
}

/** Cluster markers: a tap zooms in until the cluster splits. */
function useClusterMarkers(map: mapboxgl.Map | null, clusters: ClusterFeature<ClusterProps>[], index: ClusterIndex) {
  const markers = useRef(new Map<string, { marker: mapboxgl.Marker; key: string }>());
  const indexRef = useRef(index);
  useEffect(() => {
    indexRef.current = index;
  }, [index]);
  useEffect(() => {
    if (!map) return;
    const seen = new Set<string>();
    for (const c of clusters) {
      const [lng, lat] = c.geometry.coordinates;
      const id = `${c.properties.cluster_id}`;
      seen.add(id);
      const count = c.properties.point_count;
      const key = `${count}|${c.properties.pending > 0 ? 1 : 0}|${lng}|${lat}`;
      const existing = markers.current.get(id);
      if (existing?.key === key) continue;
      existing?.marker.remove();
      const el = document.createElement('div');
      el.className = 'spot-cluster-marker';
      el.setAttribute('role', 'button');
      el.tabIndex = 0;
      el.setAttribute('aria-label', `${count}`);
      el.innerHTML = buildClusterHtml(count, c.properties.pending > 0);
      const open = (e: Event) => {
        e.stopPropagation();
        let zoom = CLUSTER_MAX_ZOOM + 1;
        try {
          zoom = Math.min(indexRef.current.getClusterExpansionZoom(c.properties.cluster_id), CLUSTER_MAX_ZOOM + 1);
        } catch {
          // The index changed meanwhile: zoom in one step.
          zoom = map.getZoom() + 2;
        }
        map.easeTo({ center: [lng, lat], zoom: Math.max(zoom, map.getZoom() + 1), duration: prefersReducedMotion() ? 0 : 500 });
      };
      el.addEventListener('click', open);
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') open(e);
      });
      const marker = new mapboxgl.Marker({ element: el, anchor: 'center' }).setLngLat([lng, lat]).addTo(map);
      markers.current.set(id, { marker, key });
    }
    for (const [id, entry] of markers.current) {
      if (seen.has(id)) continue;
      entry.marker.remove();
      markers.current.delete(id);
    }
  }, [map, clusters]);
  useEffect(() => {
    if (!map) return;
    const all = markers.current;
    return () => {
      for (const entry of all.values()) entry.marker.remove();
      all.clear();
    };
  }, [map]);
}
