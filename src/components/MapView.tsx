'use client';

import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
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
    <Marker position={position}>
      <Popup>
        <div className="text-center">
          <p className="font-semibold">You are here</p>
          <p className="text-xs text-gray-600 mt-1">Current location</p>
        </div>
      </Popup>
    </Marker>
  );
}

export default function MapView() {
  const defaultCenter: [number, number] = [47.4979, 19.0402]; // Budapest, Hungary

  return (
    <div className="absolute inset-0 w-full h-full">
      <MapContainer
        center={defaultCenter}
        zoom={6}
        className="w-full h-full"
        zoomControl={true}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        
        <LocationMarker />
        
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
