'use client';

import { GoogleMap, useJsApiLoader, MarkerF, InfoWindow } from '@react-google-maps/api';
import { useEffect, useState, useCallback } from 'react';
import type { Spot } from '@/store/useSpotStore';
import { useMapThemeStore, mapThemes } from '@/store/useMapThemeStore';
import { useLanguageStore } from '@/store/useLanguageStore';
import SpotInfoWindow from './SpotInfoWindow';

// Define libraries as a constant to prevent unnecessary reloads
const GOOGLE_MAPS_LIBRARIES: ('places')[] = ['places'];

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

// Category emoji markers
const getCategoryIcon = (category: string, status: 'approved' | 'pending' | 'rejected', isHighlighted: boolean = false) => {
  const baseUrl = 'data:image/svg+xml;charset=UTF-8,';
  
  // Get emoji based on category
  let emoji = '📍';
  switch (category) {
    case 'scenic':
      emoji = '🌅';
      break;
    case 'smoke-spot':
      emoji = '💨';
      break;
    case 'viewpoint':
      emoji = '🏔️';
      break;
    case 'hiking':
      emoji = '🥾';
      break;
    case 'random':
      emoji = '🎲';
      break;
    case 'date-spot':
      emoji = '❤️';
      break;
    case 'park':
      emoji = '🌳';
      break;
    case 'part':
      emoji = '🏖️';
      break;
  }
  
  // Color based on status (for admin view)
  let bgColor = status === 'approved' ? '#10b981' : '#eab308'; // green vs yellow
  
  // If highlighted, use prominent gold color with glow effect
  if (isHighlighted) {
    bgColor = '#FFD700'; // bright gold for highlighted
  }
  
  const svg = isHighlighted
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56">
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <circle cx="28" cy="28" r="24" fill="${bgColor}" stroke="#FFA500" stroke-width="3" filter="url(#glow)"/>
        <text x="28" y="35" font-size="22" text-anchor="middle">${emoji}</text>
        <text x="46" y="14" font-size="18">⭐</text>
      </svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r="20" fill="${bgColor}" opacity="0.9"/>
        <text x="24" y="30" font-size="20" text-anchor="middle" fill="white">${emoji}</text>
      </svg>`;
  
  return baseUrl + encodeURIComponent(svg);
};

// Clean/Simple map style additions - removes POIs and unnecessary labels, shows country borders
const baseMapStyles = [
  {
    featureType: 'poi',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'poi.business',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'transit',
    elementType: 'labels.icon',
    stylers: [{ visibility: 'off' }],
  },
  // Show country borders
  {
    featureType: 'administrative.country',
    elementType: 'geometry.stroke',
    stylers: [{ visibility: 'on' }, { weight: 1.5 }, { color: '#888888' }],
  },
  // Hide other admin boundaries
  {
    featureType: 'administrative.province',
    elementType: 'geometry',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'administrative.land_parcel',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'administrative.neighborhood',
    stylers: [{ visibility: 'off' }],
  },
];

export default function MapView({ 
  isAddingSpot = false, 
  onLocationSelect, 
  tempMarker,
  spots = [],
  isAdmin = false,
  onSpotDetailsOpen,
  onMapLoad,
  onMapClick
}: Readonly<MapViewProps>) {
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [selectedSpot, setSelectedSpot] = useState<Spot | null>(null);
  const [zoomLevel, setZoomLevel] = useState(13);
  const defaultCenter = { lat: 47.4979, lng: 19.0402 }; // Budapest, Hungary
  
  // Get current map theme
  const { theme } = useMapThemeStore();
  const { t } = useLanguageStore();
  
  // Combine base styles with theme-specific styles
  const mapStyles = [...baseMapStyles, ...mapThemes[theme]];
  
  const mapOptions: google.maps.MapOptions = {
    // If satellite theme selected, use satellite mapType and don't apply styles
    styles: theme === 'satellite' ? undefined : mapStyles,
    disableDefaultUI: true,
    zoomControl: false,
    mapTypeControl: false,
    scaleControl: false,
    streetViewControl: false,
    rotateControl: false,
    fullscreenControl: false,
    clickableIcons: false,
    gestureHandling: 'greedy' as const,
    mapTypeId: theme === 'satellite' ? google.maps.MapTypeId.SATELLITE : undefined,
  };

  // Calculate marker size based on zoom level
  const getMarkerSize = useCallback((zoom: number) => {
    // Zoom levels: 1-22
    // At zoom 1-5: tiny (24px)
    // At zoom 6-10: small (32px)
    // At zoom 11-14: medium (48px)
    // At zoom 15-18: large (64px)
    // At zoom 19-22: extra large (80px)
    if (zoom <= 5) return 24;
    if (zoom <= 10) return 32;
    if (zoom <= 14) return 48;
    if (zoom <= 18) return 64;
    return 80;
  }, []);

  // Load Google Maps API
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  // Notify parent when map is loaded
  useEffect(() => {
    if (isLoaded && !loadError && onMapLoad) {
      // Give it a moment to ensure everything is ready
      const timer = setTimeout(() => {
        onMapLoad();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isLoaded, loadError, onMapLoad]);

  // Get user's current location (only once when map loads)
  useEffect(() => {
    if (navigator.geolocation && isLoaded && !userLocation) {
      // Check cached location first (10 minutes cache)
      const cachedLocation = sessionStorage.getItem('userLocation');
      const cachedTime = sessionStorage.getItem('userLocationTime');
      
      if (cachedLocation && cachedTime) {
        const age = Date.now() - Number.parseInt(cachedTime, 10);
        if (age < 10 * 60 * 1000) { // 10 minutes
          const cached = JSON.parse(cachedLocation);
          setUserLocation(cached);
          if (map) {
            map.panTo(cached);
            map.setZoom(13);
          }
          return;
        }
      }
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const newLocation = { lat: latitude, lng: longitude };
          setUserLocation(newLocation);
          
          // Cache location
          sessionStorage.setItem('userLocation', JSON.stringify(newLocation));
          sessionStorage.setItem('userLocationTime', Date.now().toString());
          
          // Fly to user location if map is loaded
          if (map) {
            map.panTo(newLocation);
            map.setZoom(13);
          }
        },
        (error) => {
          setUserLocation(defaultCenter);
        },
        {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 600000, // 10 minutes
        }
      );
    }
  }, [isLoaded, map, userLocation]);

  // Handle map click for adding spots or closing spot details
  const handleMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (isAddingSpot && onLocationSelect && e.latLng) {
      onLocationSelect({
        lat: e.latLng.lat(),
        lng: e.latLng.lng(),
      });
    } else {
      // Clear selected spot when clicking on map
      setSelectedSpot(null);
      // Also notify parent to close spot details
      if (onMapClick) {
        onMapClick();
      }
    }
  }, [isAddingSpot, onLocationSelect, onMapClick]);

  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
    // Listen to zoom changes
    map.addListener('zoom_changed', () => {
      const zoom = map.getZoom() || 13;
      setZoomLevel(zoom);
    });
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  if (loadError) {
    return (
      <div className="w-full h-[100dvh] bg-slate-900 flex items-center justify-center">
        <div className="glass-card px-8 py-4">
          <p className="text-white font-medium">{t('mapLoadError')}</p>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return null; // Return nothing, LoadingScreen handles this
  }

  return (
    <div className="absolute inset-0 w-full h-full z-0">
      {/* Valentine Theme Overlay - Subtle gradient edges */}
      {theme === 'valentine' && (
        <div className="absolute inset-0 pointer-events-none z-10">
          <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-pink-200/20 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-rose-200/20 to-transparent" />
        </div>
      )}

      {/* Instructions overlay when adding spot */}
      {isAddingSpot && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[1000] glass-card px-6 py-3 pointer-events-none animate-fade-in">
          <p className="text-white font-medium text-center">
            {t('clickMapToSelect')}
          </p>
        </div>
      )}

      <GoogleMap
        mapContainerStyle={{ width: '100%', height: '100%' }}
        center={userLocation || defaultCenter}
        zoom={userLocation ? 13 : 6}
        options={{
          ...mapOptions,
        }}
        onClick={handleMapClick}
        onLoad={onLoad}
        onUnmount={onUnmount}
      >
        {/* User location marker - blue dot */}
        {userLocation && (
          <MarkerF
            position={userLocation}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              fillColor: '#007AFF',
              fillOpacity: 1,
              strokeColor: '#FFFFFF',
              strokeWeight: 3,
              scale: 8,
            }}
            title="You are here"
          />
        )}

        {/* Temporary marker when selecting location */}
        {tempMarker && (
          <MarkerF
            position={tempMarker}
            animation={google.maps.Animation.DROP}
          />
        )}

        {/* Real spots from Firestore */}
        {spots.map((spot) => {
          const markerSize = getMarkerSize(zoomLevel);
          // Check if spot has active (non-expired) highlights
          const now = new Date().toISOString();
          const activeHighlights = (spot.highlighted || []).filter(
            (h) => h.expiresAt > now
          );
          const isHighlighted = activeHighlights.length > 0;
          // Highlighted spots get a bigger marker
          const finalMarkerSize = isHighlighted ? markerSize * 1.2 : markerSize;
          return (
            <MarkerF
              key={spot.id}
              position={spot.location}
              title={spot.name}
              zIndex={isHighlighted ? 999 : 1}
              icon={{
                url: getCategoryIcon(spot.category, spot.status, isHighlighted),
                scaledSize: new google.maps.Size(finalMarkerSize, finalMarkerSize),
                anchor: new google.maps.Point(finalMarkerSize / 2, finalMarkerSize / 2),
              }}
              onClick={() => setSelectedSpot(spot)}
            />
          );
        })}

        {/* InfoWindow for selected spot */}
        {selectedSpot && (
          <InfoWindow
            position={selectedSpot.location}
            onCloseClick={() => setSelectedSpot(null)}
            options={{
              pixelOffset: new google.maps.Size(0, -40),
              disableAutoPan: false,
            }}
          >
            <SpotInfoWindow
              spot={selectedSpot}
              isAdmin={isAdmin}
              onClose={() => setSelectedSpot(null)}
              onViewDetails={() => {
                onSpotDetailsOpen?.(selectedSpot);
                setSelectedSpot(null);
              }}
            />
          </InfoWindow>
        )}
      </GoogleMap>
    </div>
  );
}
