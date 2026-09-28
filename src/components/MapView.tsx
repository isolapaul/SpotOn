'use client';

import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Spot } from '@/store/useSpotStore';
import { useMapThemeStore, mapThemes } from '@/store/useMapThemeStore';
import SpotInfoWindow from './SpotInfoWindow';
import { buildPinHtml, markerVariant, PIN_ANCHOR, PIN_SIZE, zoomBand, type MarkerVariant } from '@/lib/mapMarkers';
import {
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  DELAYS,
  LOCATE_ZOOM,
  Z,
} from '@/lib/constants';

interface MapViewProps {
  isAddingSpot?: boolean;
  onLocationSelect?: (location: { lat: number; lng: number }) => void;
  tempMarker?: { lat: number; lng: number } | null;
  spots?: Spot[];
  /** Blue dot and one-time pan target (page: the shared location, or the default centre once denied). */
  userLocation?: { lat: number; lng: number } | null;
  onSpotDetailsOpen?: (spot: Spot) => void;
  onMapLoad?: () => void;
  onMapClick?: () => void;
}

// Pin icons (design 1D): one size at every zoom, anchored at the pin's tip. Icons are cached so
// unchanged markers keep the same icon reference: react-leaflet calls setIcon (rebuilding the
// marker DOM) whenever the reference changes, so zooming never rebuilds markers any more.
const iconCache = new Map<string, L.DivIcon>();

const getPinIcon = (category: string, variant: MarkerVariant, highlighted: boolean) => {
  const key = `${category}|${variant}|${highlighted ? 1 : 0}`;
  let icon = iconCache.get(key);
  if (!icon) {
    icon = L.divIcon({
      html: buildPinHtml({ category, variant, highlighted }),
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

// Leaflet measures its container once; the installed iOS app grows it afterwards (--app-h, design
// 1A), so re-measure whenever the container's size changes or no tiles load below the old height.
function MapResizeWatcher() {
  const map = useMap();
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize({ pan: false }));
    observer.observe(map.getContainer());
    return () => observer.disconnect();
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

// Pans map to user location when it becomes available
function LocationPanner({ userLocation }: { userLocation: { lat: number; lng: number } | null }) {
  const map = useMap();
  const panned = useRef(false);

  useEffect(() => {
    if (userLocation && !panned.current) {
      panned.current = true;
      map.setView([userLocation.lat, userLocation.lng], LOCATE_ZOOM, { animate: true });
    }
  }, [userLocation, map]);

  return null;
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
    />
  );
}

export default function MapView({
  isAddingSpot = false,
  onLocationSelect,
  tempMarker,
  spots = [],
  userLocation = null,
  onSpotDetailsOpen,
  onMapLoad,
  onMapClick,
}: Readonly<MapViewProps>) {
  const [selectedSpot, setSelectedSpot] = useState<Spot | null>(null);

  const { theme } = useMapThemeStore();

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
        <LocationPanner userLocation={userLocation} />
        <TileLayerSwitcher theme={theme} />
        <ZoomBandTracker />
        <MapResizeWatcher />
        <MapEventHandler
          isAddingSpot={isAddingSpot}
          onLocationSelect={onLocationSelect}
          onMapClick={() => {
            setSelectedSpot(null);
            onMapClick?.();
          }}
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
        {spots.map((spot) => {
          const isHighlighted = (spot.highlighted || []).some((h) => h.expiresAt > nowIso);
          return (
            <Marker
              key={spot.id}
              position={[spot.location.lat, spot.location.lng]}
              title={spot.name}
              icon={getPinIcon(spot.category, markerVariant(spot.status), isHighlighted)}
              zIndexOffset={isHighlighted ? 1000 : 0}
              eventHandlers={{
                click: () => setSelectedSpot(spot),
              }}
            />
          );
        })}
      </MapContainer>

      {/* Info popup rendered outside MapContainer (avoids Leaflet popup styling conflicts) */}
      {selectedSpot && (
        <div className={`absolute left-1/2 -translate-x-1/2 ${Z.mapInner} animate-fade-in`}
          style={{ bottom: '100px' }}>
          <SpotInfoWindow
            spot={selectedSpot}
            onClose={() => setSelectedSpot(null)}
            onViewDetails={() => {
              onSpotDetailsOpen?.(selectedSpot);
              setSelectedSpot(null);
            }}
          />
        </div>
      )}
    </div>
  );
}
