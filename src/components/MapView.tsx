'use client';

import { MapContainer, TileLayer, Marker, Popup, useMap, CircleMarker, useMapEvents } from 'react-leaflet';
import { useEffect, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in React-Leaflet
const icon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

L.Marker.prototype.options.icon = icon;

// iPhone-style blue dot for user location
const userLocationStyle = {
  color: '#007AFF',
  fillColor: '#007AFF',
  fillOpacity: 1,
  weight: 3,
  radius: 8,
};

interface MapViewProps {
  isAddingSpot?: boolean;
  onLocationSelect?: (location: { lat: number; lng: number }) => void;
  tempMarker?: { lat: number; lng: number } | null;
}

// Component to handle user location
function LocationMarker() {
  const [position, setPosition] = useState<[number, number] | null>(null);
  const map = useMap();

  useEffect(() => {
    // Get user's current location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          const newPosition: [number, number] = [latitude, longitude];
          setPosition(newPosition);
          map.flyTo(newPosition, 13, {
            duration: 1.5,
          });
        },
        (error) => {
          console.error('Error getting location:', error);
          // Default to a central location if geolocation fails
          const defaultPosition: [number, number] = [47.4979, 19.0402]; // Budapest
          setPosition(defaultPosition);
          map.setView(defaultPosition, 6);
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0,
        }
      );
    }
  }, [map]);

  return position === null ? null : (
    <CircleMarker 
      center={position} 
      pathOptions={userLocationStyle}
      radius={8}
    >
      <Popup>
        <div className="text-center">
          <p className="font-semibold">You are here</p>
          <p className="text-xs text-gray-600 mt-1">Current location</p>
        </div>
      </Popup>
    </CircleMarker>
  );
}

// Component to handle map clicks for adding spots
function MapClickHandler({ 
  isAddingSpot, 
  onLocationSelect 
}: { 
  isAddingSpot: boolean; 
  onLocationSelect: (location: { lat: number; lng: number }) => void;
}) {
  useMapEvents({
    click(e) {
      if (isAddingSpot) {
        onLocationSelect({ lat: e.latlng.lat, lng: e.latlng.lng });
      }
    },
  });
  return null;
}

export default function MapView({ 
  isAddingSpot = false, 
  onLocationSelect, 
  tempMarker 
}: Readonly<MapViewProps>) {
  const defaultCenter: [number, number] = [47.4979, 19.0402]; // Budapest, Hungary

  return (
    <div className="absolute inset-0 w-full h-full">
      {/* Instructions overlay when adding spot */}
      {isAddingSpot && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[1000] glass-card px-6 py-3 pointer-events-none animate-fade-in">
          <p className="text-white font-medium text-center">
            📍 Tap on the map to select location
          </p>
        </div>
      )}

      <MapContainer
        center={defaultCenter}
        zoom={6}
        className="w-full h-full"
        zoomControl={true}
        attributionControl={false}
        style={{ cursor: isAddingSpot ? 'crosshair' : 'grab' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        
        <LocationMarker />
        
        {/* Map click handler for adding spots */}
        {isAddingSpot && onLocationSelect && (
          <MapClickHandler 
            isAddingSpot={isAddingSpot} 
            onLocationSelect={onLocationSelect} 
          />
        )}
        
        {/* Temporary marker when selecting location */}
        {tempMarker && (
          <Marker position={[tempMarker.lat, tempMarker.lng]}>
            <Popup>
              <div className="text-center">
                <p className="font-semibold">New Spot Location</p>
                <p className="text-xs text-gray-600 mt-1">
                  {tempMarker.lat.toFixed(6)}, {tempMarker.lng.toFixed(6)}
                </p>
              </div>
            </Popup>
          </Marker>
        )}
        
        {/* Sample marker - will be replaced with real data later */}
        <Marker position={[47.4979, 19.0402]}>
          <Popup>
            <div className="min-w-[200px]">
              <h3 className="font-bold text-lg mb-1">Sample Spot</h3>
              <p className="text-sm text-gray-600 mb-2">
                This is a demo spot. Real spots will appear here in Phase 2.
              </p>
              <button className="w-full bg-primary-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-600 transition-colors">
                View Details
              </button>
            </div>
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}
