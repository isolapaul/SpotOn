'use client';

import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api';
import { useEffect, useState, useCallback } from 'react';
import type { Spot } from '@/store/useSpotStore';
import SpotInfoWindow from './SpotInfoWindow';

interface MapViewProps {
  isAddingSpot?: boolean;
  onLocationSelect?: (location: { lat: number; lng: number }) => void;
  tempMarker?: { lat: number; lng: number } | null;
  spots?: Spot[];
  onSpotDetailsOpen?: (spot: Spot) => void;
}

// Clean/Simple map style - removes POIs and unnecessary labels
const mapStyles = [
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
];

const mapOptions = {
  styles: mapStyles,
  disableDefaultUI: false,
  zoomControl: true,
  mapTypeControl: false,
  scaleControl: false,
  streetViewControl: false,
  rotateControl: false,
  fullscreenControl: false,
};

export default function MapView({ 
  isAddingSpot = false, 
  onLocationSelect, 
  tempMarker,
  spots = [],
  onSpotDetailsOpen
}: Readonly<MapViewProps>) {
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [selectedSpot, setSelectedSpot] = useState<Spot | null>(null);
  const defaultCenter = { lat: 47.4979, lng: 19.0402 }; // Budapest, Hungary

  // Load Google Maps API
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries: ['places'],
  });

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
          console.error('Error getting location:', error);
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

  // Handle map click for adding spots
  const handleMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (isAddingSpot && onLocationSelect && e.latLng) {
      onLocationSelect({
        lat: e.latLng.lat(),
        lng: e.latLng.lng(),
      });
    }
  }, [isAddingSpot, onLocationSelect]);

  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  if (loadError) {
    return (
      <div className="w-full h-[100dvh] bg-slate-900 flex items-center justify-center">
        <div className="glass-card px-8 py-4">
          <p className="text-white font-medium">Error loading maps</p>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="w-full h-[100dvh] bg-slate-900 flex items-center justify-center">
        <div className="glass-card px-8 py-4">
          <p className="text-white font-medium">Loading map...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 w-full h-full">
      {/* Instructions overlay when adding spot */}
      {isAddingSpot && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[1000] glass-card px-6 py-3 pointer-events-none animate-fade-in">
          <p className="text-white font-medium text-center">
            📍 Click on the map to select location
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
          <Marker
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
          <Marker
            position={tempMarker}
            animation={google.maps.Animation.DROP}
          />
        )}

        {/* Real spots from Firestore */}
        {spots.map((spot) => (
          <Marker
            key={spot.id}
            position={spot.location}
            title={spot.name}
            onClick={() => setSelectedSpot(spot)}
          />
        ))}

        {/* InfoWindow for selected spot */}
        {selectedSpot && (
          <InfoWindow
            position={selectedSpot.location}
            onCloseClick={() => setSelectedSpot(null)}
            options={{
              pixelOffset: new google.maps.Size(0, -40),
            }}
          >
            <div>
              <SpotInfoWindow
                spot={selectedSpot}
                onClose={() => setSelectedSpot(null)}
                onViewDetails={() => {
                  onSpotDetailsOpen?.(selectedSpot);
                  setSelectedSpot(null);
                }}
              />
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
    </div>
  );
}
