'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Spot } from '@/store/useSpotStore';
import { useMapThemeStore, mapThemes } from '@/store/useMapThemeStore';
import { buildPinHtml, markerVariant, PIN_ANCHOR, PIN_SIZE, zoomBand, type MarkerVariant } from '@/lib/mapMarkers';
import { normalizePinIcon, type PinIconId } from '@/lib/pinGlyphs';
import type { CategoryIconId } from '@/lib/categoryIcons';
import { normalizeCategory } from '@/lib/categoryGlyphs';
import { useCategoryStore } from '@/store/useCategoryStore';
import {
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  DELAYS,
  LOCATE_ZOOM,
  SPOT_FOCUS,
  Z,
} from '@/lib/constants';

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

// Pin icons (design 1D): one size at every zoom, anchored at the pin's tip. Icons are cached so
// unchanged markers keep the same icon reference: react-leaflet calls setIcon (rebuilding the
// marker DOM) whenever the reference changes, so zooming never rebuilds markers any more.
const iconCache = new Map<string, L.DivIcon>();

const getPinIcon = (
  category: string,
  categoryIcon: CategoryIconId | null,
  variant: MarkerVariant,
  highlighted: boolean,
  pin: PinIconId | null,
) => {
  const key = `${normalizeCategory(category)}|${categoryIcon ?? ''}|${variant}|${highlighted ? 1 : 0}|${pin ?? ''}`;
  let icon = iconCache.get(key);
  if (!icon) {
    icon = L.divIcon({
      html: buildPinHtml({ category, categoryIcon, variant, highlighted, pin }),
      className: 'spot-marker',
      iconSize: [...PIN_SIZE],
      iconAnchor: [...PIN_ANCHOR],
    });
    iconCache.set(key, icon);
  }
  return icon;
};

// The user's position: a static iOS-style dot (no endless pulse, senior UI review M6).
const userLocationIcon = L.divIcon({
  html: '<span class="user-puck" aria-hidden="true"><span class="user-puck__halo"></span><span class="user-puck__dot"></span></span>',
  className: '',
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

// The location picked while adding a spot: a brand pin with a plus, dropped in once.
const tempMarkerIcon = L.divIcon({
  html:
    '<div class="draft-pin" aria-hidden="true"><svg width="44" height="54" viewBox="0 0 44 54">' +
    '<ellipse cx="22" cy="50.6" rx="6" ry="2" fill="#000" opacity=".22"/>' +
    '<path d="M22 50C20.6 45.5 18 41.8 14.9 36.5A18 18 0 1 1 29.1 36.5C26 41.8 23.4 45.5 22 50Z" fill="#12814F" stroke="#fff" stroke-width="3"/>' +
    '<path d="M22 13v14M15 20h14" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/></svg></div>',
  className: '',
  iconSize: [...PIN_SIZE],
  iconAnchor: [...PIN_ANCHOR],
});

// Mirrors the zoom on the map container (data-zoom-band): far zoom collapses pins to dots in CSS.
function ZoomBandTracker() {
  const map = useMap();
  useEffect(() => {
    const apply = () => {
      map.getContainer().dataset.zoomBand = zoomBand(map.getZoom());
    };
    apply();
    map.on('zoomend', apply);
    return () => {
      map.off('zoomend', apply);
    };
  }, [map]);
  return null;
}

// Fires onMapLoad once after the map is ready
function MapReadyNotifier({ onMapLoad }: { onMapLoad?: () => void }) {
  const notified = useRef(false);
  useMap(); // ensures we're inside MapContainer context
  useEffect(() => {
    if (notified.current || !onMapLoad) return;
    const timer = setTimeout(() => {
      notified.current = true;
      onMapLoad();
    }, DELAYS.mapReady);
    return () => clearTimeout(timer);
  }, [onMapLoad]);
  return null;
}

// Handles map clicks (placing a spot, or closing the info window)
function MapEventHandler({
  isAddingSpot,
  onLocationSelect,
  onMapClick,
}: {
  isAddingSpot: boolean;
  onLocationSelect?: (loc: { lat: number; lng: number }) => void;
  onMapClick?: () => void;
}) {
  useMapEvents({
    click(e) {
      if (isAddingSpot && onLocationSelect) {
        onLocationSelect({ lat: e.latlng.lat, lng: e.latlng.lng });
      } else if (onMapClick) {
        onMapClick();
      }
    },
  });
  return null;
}

// Pans the map to the user's location once when it becomes available, and again (a smooth fly) on
// every locate request; a request made before the location is known is served when it arrives.
function LocationPanner({ userLocation, locateRequest }: { userLocation: { lat: number; lng: number } | null; locateRequest: number }) {
  const map = useMap();
  const panned = useRef(false);
  const servedRequest = useRef(locateRequest);

  useEffect(() => {
    if (!userLocation) return;
    if (!panned.current) {
      panned.current = true;
      servedRequest.current = locateRequest;
      map.setView([userLocation.lat, userLocation.lng], LOCATE_ZOOM, { animate: true });
    } else if (locateRequest !== servedRequest.current) {
      servedRequest.current = locateRequest;
      map.flyTo([userLocation.lat, userLocation.lng], Math.max(map.getZoom(), LOCATE_ZOOM), { duration: 0.8 });
    }
  }, [userLocation, locateRequest, map]);

  return null;
}

// Flies to a focused spot (opened from the profile) and reports the arrival, once per request. The spot
// lands a little above the centre, clear of the place card; reduced motion jumps instead of flying.
function SpotFocuser({ focus, spots, onArrive }: {
  focus: { spotId: string; seq: number } | null;
  spots: Spot[];
  onArrive?: (spotId: string) => void;
}) {
  const map = useMap();
  const served = useRef(0);
  const onArriveRef = useRef(onArrive);
  useEffect(() => {
    onArriveRef.current = onArrive;
  });
  // Only the target matters: a spots snapshot during the flight must not restart or cancel it.
  const target = focus ? spots.find((s) => s.id === focus.spotId)?.location ?? null : null;
  const lat = target?.lat;
  const lng = target?.lng;

  useEffect(() => {
    if (!focus || focus.seq === served.current || lat === undefined || lng === undefined) return;
    served.current = focus.seq;
    const zoom = Math.max(map.getZoom(), SPOT_FOCUS.zoom);
    const lifted = map.project([lat, lng], zoom).add([0, SPOT_FOCUS.liftPx]);
    const center = map.unproject(lifted, zoom);
    let done = false;
    const arrive = () => {
      if (done) return;
      done = true;
      onArriveRef.current?.(focus.spotId);
    };
    const reduced = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      map.setView(center, zoom, { animate: false });
      arrive();
      return;
    }
    map.once('moveend', arrive);
    map.flyTo(center, zoom, { duration: SPOT_FOCUS.durationS });
    const fallback = setTimeout(arrive, SPOT_FOCUS.fallbackMs);
    return () => {
      clearTimeout(fallback);
      map.off('moveend', arrive);
    };
  }, [focus, lat, lng, map]);

  return null;
}

// Marks the selected pin's DOM (data-selected) so CSS grows it; the icons stay cached and shared.
function useSelectedPin(markers: Map<string, L.Marker>, selectedSpotId: string | null, spots: Spot[]) {
  useEffect(() => {
    if (!selectedSpotId) return;
    const marker = markers.get(selectedSpotId);
    const pin = marker?.getElement()?.querySelector<HTMLElement>('.spot-pin');
    if (!marker || !pin) return;
    pin.dataset.selected = 'true';
    marker.setZIndexOffset(2000);
    return () => {
      delete pin.dataset.selected;
      marker.setZIndexOffset(0);
    };
    // spots: a re-render may swap a marker's icon (new DOM), so re-apply after it.
  }, [markers, selectedSpotId, spots]);
}

// Swaps tile layer when theme changes without remounting map
function TileLayerSwitcher({ theme }: { theme: string }) {
  const config = mapThemes[theme as keyof typeof mapThemes] ?? mapThemes.standard;
  return (
    <TileLayer
      key={theme}
      url={config.url}
      attribution={config.attribution}
      className={config.className}
      // Only the options a theme sets: an explicit undefined would replace Leaflet's defaults
      {...(config.detectRetina ? { detectRetina: true, maxZoom: config.maxZoom } : {})}
    />
  );
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
  const { theme } = useMapThemeStore();
  const [markers] = useState(() => new Map<string, L.Marker>());
  useSelectedPin(markers, selectedSpotId, spots);
  // Icons of the super admin's categories (item 7), by category id.
  const customCategories = useCategoryStore((s) => s.categories);
  const customIcons = useMemo(() => new Map(customCategories.map((c) => [c.id, c.icon])), [customCategories]);

  // Highlight-expiry reference time, computed once per render (not per marker)
  const nowIso = new Date().toISOString();

  return (
    <div className={`absolute inset-0 w-full h-full ${Z.mapBase}`}>
      <MapContainer
        center={DEFAULT_MAP_CENTER}
        zoom={DEFAULT_MAP_ZOOM}
        style={{ width: '100%', height: '100%' }}
        zoomControl={false}
        attributionControl={false}
      >
        <MapReadyNotifier onMapLoad={onMapLoad} />
        <LocationPanner userLocation={userLocation} locateRequest={locateRequest} />
        <SpotFocuser focus={focusRequest} spots={spots} onArrive={onSpotArrive} />
        <TileLayerSwitcher theme={theme} />
        <ZoomBandTracker />
        <MapEventHandler
          isAddingSpot={isAddingSpot}
          onLocationSelect={onLocationSelect}
          onMapClick={onMapClick}
        />

        {/* User location dot */}
        {userLocation && (
          <Marker position={[userLocation.lat, userLocation.lng]} icon={userLocationIcon} />
        )}

        {/* Temporary marker during spot creation */}
        {tempMarker && (
          <Marker position={[tempMarker.lat, tempMarker.lng]} icon={tempMarkerIcon} />
        )}

        {/* Spot markers */}
        {spots.map((spot, index) => {
          const isHighlighted = (spot.highlighted || []).some((h) => h.expiresAt > nowIso);
          return (
            <Marker
              key={spot.id}
              position={[spot.location.lat, spot.location.lng]}
              title={spot.name}
              icon={getPinIcon(spot.category, customIcons.get(spot.category) ?? null, markerVariant(spot.status), isHighlighted, normalizePinIcon(spot.ownerPin))}
              zIndexOffset={isHighlighted ? 1000 : 0}
              ref={(m) => {
                if (m) {
                  markers.set(spot.id, m);
                  // Pins land one after another (a short cascade, capped), not all at once.
                  m.getElement()?.style.setProperty('--pin-delay', `${Math.min(index, 24) * 22}ms`);
                } else markers.delete(spot.id);
              }}
              eventHandlers={{
                click: () => onSpotPreview?.(spot.id),
              }}
            />
          );
        })}
      </MapContainer>
    </div>
  );
}
