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
const getCategoryIcon = (category: string, status: 'approved' | 'pending' | 'rejected') => {
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
    case 'other':
      emoji = '📍';
      break;
  }
  
  // Color based on status (for admin view)
  const bgColor = status === 'approved' ? '#10b981' : '#eab308'; // green vs yellow
  
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
    <circle cx="24" cy="24" r="20" fill="${bgColor}" opacity="0.9"/>
    <text x="24" y="30" font-size="20" text-anchor="middle" fill="white">${emoji}</text>
  </svg>`;
  
  return baseUrl + encodeURIComponent(svg);
};

// Clean/Simple map style additions - removes POIs and unnecessary labels
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
  {
    featureType: 'administrative',
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
  
  const mapOptions = {
    styles: mapStyles,
    disableDefaultUI: true,
    zoomControl: false,
    mapTypeControl: false,
    scaleControl: false,
    streetViewControl: false,
    rotateControl: false,
    fullscreenControl: false,
    clickableIcons: false,
    gestureHandling: 'greedy' as const,
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

  // Get user's current location
  useEffect(() => {
    if (navigator.geolocation && isLoaded) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const newLocation = { lat: latitude, lng: longitude };
          setUserLocation(newLocation);
          
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
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0,
        }
      );
    }
  }, [isLoaded, map]);

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
          return (
            <MarkerF
              key={spot.id}
              position={spot.location}
              title={spot.name}
              icon={{
                url: getCategoryIcon(spot.category, spot.status),
                scaledSize: new google.maps.Size(markerSize, markerSize),
                anchor: new google.maps.Point(markerSize / 2, markerSize / 2),
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
