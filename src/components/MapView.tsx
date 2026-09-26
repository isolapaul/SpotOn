'use client';

import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Spot } from '@/store/useSpotStore';
import { useMapThemeStore, mapThemes } from '@/store/useMapThemeStore';
import { useT } from '@/hooks/useT';
import SpotInfoWindow from './SpotInfoWindow';
import { buildMarkerSvg, getMarkerSize, type MarkerStatus } from '@/lib/mapMarkers';
import {
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  DELAYS,
  GEOLOCATION_TIMEOUT_MS,
  INITIAL_MARKER_ZOOM,
  LOCATE_ZOOM,
  LOCATION_CACHE_MAX_AGE_MS,
  Z,
} from '@/lib/constants';

interface MapViewProps {
  isAddingSpot?: boolean;
  onLocationSelect?: (location: { lat: number; lng: number }) => void;
  tempMarker?: { lat: number; lng: number } | null;
  spots?: Spot[];
  isAdmin?: boolean;
  onSpotDetailsOpen?: (spot: Spot) => void;
  onMapLoad?: () => void;
  onMapClick?: () => void;
}

const getCategoryIcon = (category: string, status: MarkerStatus, isHighlighted: boolean, size: number) => {
  return L.divIcon({
    html: buildMarkerSvg(category, status, isHighlighted, size),
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
};

// Marker icons are cached so unchanged markers keep the same icon reference: react-leaflet calls
// setIcon (rebuilding the marker DOM) whenever the reference changes.
const iconCache = new Map<string, L.DivIcon>();

const getCachedCategoryIcon = (category: string, status: MarkerStatus, isHighlighted: boolean, size: number) => {
  const key = `${category}|${status}|${isHighlighted ? 1 : 0}|${size}`;
  let icon = iconCache.get(key);
  if (!icon) {
    icon = getCategoryIcon(category, status, isHighlighted, size);
    iconCache.set(key, icon);
  }
  return icon;
};

const userLocationIcon = L.divIcon({
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="8" fill="#007AFF" stroke="white" stroke-width="3"/>
  </svg>`,
  className: '',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const tempMarkerIcon = L.divIcon({
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
    <circle cx="16" cy="16" r="12" fill="#f59e0b" stroke="white" stroke-width="3"/>
    <text x="16" y="21" font-size="14" text-anchor="middle">📍</text>
  </svg>`,
  className: '',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

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

// Handles map click events and zoom tracking
function MapEventHandler({
  isAddingSpot,
  onLocationSelect,
  onMapClick,
  onZoomChange,
}: {
  isAddingSpot: boolean;
  onLocationSelect?: (loc: { lat: number; lng: number }) => void;
  onMapClick?: () => void;
  onZoomChange: (zoom: number) => void;
}) {
  useMapEvents({
    click(e) {
      if (isAddingSpot && onLocationSelect) {
        onLocationSelect({ lat: e.latlng.lat, lng: e.latlng.lng });
      } else if (onMapClick) {
        onMapClick();
      }
    },
    zoomend(e) {
      onZoomChange(e.target.getZoom());
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
  isAdmin = false,
  onSpotDetailsOpen,
  onMapLoad,
  onMapClick,
}: Readonly<MapViewProps>) {
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedSpot, setSelectedSpot] = useState<Spot | null>(null);
  // Marker sizing starts at INITIAL_MARKER_ZOOM (13), not the map's opening zoom: kept as is.
  const [zoomLevel, setZoomLevel] = useState(INITIAL_MARKER_ZOOM);

  const { theme } = useMapThemeStore();
  const t = useT();

  useEffect(() => {
    if (!navigator.geolocation) return;

    const cachedLocation = sessionStorage.getItem('userLocation');
    const cachedTime = sessionStorage.getItem('userLocationTime');

    if (cachedLocation && cachedTime) {
      const age = Date.now() - Number.parseInt(cachedTime, 10);
      if (age < LOCATION_CACHE_MAX_AGE_MS) {
        setUserLocation(JSON.parse(cachedLocation));
        return;
      }
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const loc = { lat: position.coords.latitude, lng: position.coords.longitude };
        setUserLocation(loc);
        sessionStorage.setItem('userLocation', JSON.stringify(loc));
        sessionStorage.setItem('userLocationTime', Date.now().toString());
      },
      () => setUserLocation({ lat: DEFAULT_MAP_CENTER[0], lng: DEFAULT_MAP_CENTER[1] }),
      { enableHighAccuracy: false, timeout: GEOLOCATION_TIMEOUT_MS, maximumAge: LOCATION_CACHE_MAX_AGE_MS }
    );
  }, []);

  // Highlight-expiry reference time, computed once per render (not per marker)
  const nowIso = new Date().toISOString();

  return (
    <div className={`absolute inset-0 w-full h-full ${Z.mapBase}`}>
      {isAddingSpot && (
        <div className={`absolute top-20 left-1/2 -translate-x-1/2 ${Z.mapInner} glass-card px-6 py-3 pointer-events-none animate-fade-in`}>
          <p className="text-white font-medium text-center">
            {t('clickMapToSelect')}
          </p>
        </div>
      )}

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
        <MapEventHandler
          isAddingSpot={isAddingSpot}
          onLocationSelect={onLocationSelect}
          onMapClick={() => {
            setSelectedSpot(null);
            onMapClick?.();
          }}
          onZoomChange={setZoomLevel}
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
          const size = getMarkerSize(zoomLevel) * (isHighlighted ? 1.2 : 1);
          return (
            <Marker
              key={spot.id}
              position={[spot.location.lat, spot.location.lng]}
              icon={getCachedCategoryIcon(spot.category, spot.status, isHighlighted, Math.round(size))}
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
            isAdmin={isAdmin}
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
