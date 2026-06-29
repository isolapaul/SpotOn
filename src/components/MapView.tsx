'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Spot } from '@/store/useSpotStore';
import { useMapThemeStore, mapThemes } from '@/store/useMapThemeStore';
import { useLanguageStore } from '@/store/useLanguageStore';
import SpotInfoWindow from './SpotInfoWindow';

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

const getCategoryIcon = (category: string, status: 'approved' | 'pending' | 'rejected', isHighlighted: boolean = false, size = 48) => {
  let emoji = '📍';
  switch (category) {
    case 'scenic': emoji = '🌅'; break;
    case 'smoke-spot': emoji = '💨'; break;
    case 'viewpoint': emoji = '🏔️'; break;
    case 'hiking': emoji = '🥾'; break;
    case 'random': emoji = '🎲'; break;
    case 'date-spot': emoji = '❤️'; break;
    case 'park': emoji = '🌳'; break;
    case 'part': emoji = '🏖️'; break;
  }

  let bgColor = status === 'approved' ? '#10b981' : '#eab308';
  if (isHighlighted) bgColor = '#FFD700';

  const svg = isHighlighted
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 56 56">
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        <circle cx="28" cy="28" r="24" fill="${bgColor}" stroke="#FFA500" stroke-width="3" filter="url(#glow)"/>
        <text x="28" y="35" font-size="22" text-anchor="middle">${emoji}</text>
        <text x="46" y="14" font-size="18">⭐</text>
      </svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r="20" fill="${bgColor}" opacity="0.9"/>
        <text x="24" y="30" font-size="20" text-anchor="middle" fill="white">${emoji}</text>
      </svg>`;

  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
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
    if (!notified.current && onMapLoad) {
      notified.current = true;
      const timer = setTimeout(onMapLoad, 100);
      return () => clearTimeout(timer);
    }
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
      map.setView([userLocation.lat, userLocation.lng], 13, { animate: true });
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
  const [zoomLevel, setZoomLevel] = useState(13);
  const defaultCenter: [number, number] = [47.4979, 19.0402];

  const { theme } = useMapThemeStore();
  const { t } = useLanguageStore();

  const getMarkerSize = useCallback((zoom: number) => {
    if (zoom <= 5) return 24;
    if (zoom <= 10) return 32;
    if (zoom <= 14) return 48;
    if (zoom <= 18) return 64;
    return 80;
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) return;

    const cachedLocation = sessionStorage.getItem('userLocation');
    const cachedTime = sessionStorage.getItem('userLocationTime');

    if (cachedLocation && cachedTime) {
      const age = Date.now() - Number.parseInt(cachedTime, 10);
      if (age < 10 * 60 * 1000) {
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
      () => setUserLocation({ lat: defaultCenter[0], lng: defaultCenter[1] }),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="absolute inset-0 w-full h-full z-0">
      {isAddingSpot && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[1000] glass-card px-6 py-3 pointer-events-none animate-fade-in">
          <p className="text-white font-medium text-center">
            {t('clickMapToSelect')}
          </p>
        </div>
      )}

      <MapContainer
        center={defaultCenter}
        zoom={6}
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
          const now = new Date().toISOString();
          const isHighlighted = (spot.highlighted || []).some((h) => h.expiresAt > now);
          const size = getMarkerSize(zoomLevel) * (isHighlighted ? 1.2 : 1);
          return (
            <Marker
              key={spot.id}
              position={[spot.location.lat, spot.location.lng]}
              icon={getCategoryIcon(spot.category, spot.status, isHighlighted, Math.round(size))}
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
        <div className="absolute left-1/2 -translate-x-1/2 z-[1000] animate-fade-in"
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
