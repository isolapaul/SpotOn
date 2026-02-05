'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import BottomNavigation from '@/components/BottomNavigation';
import LanguageSelector from '@/components/LanguageSelector';
import AuthModal from '@/components/AuthModal';
import AddSpotModal from '@/components/AddSpotModal';
import SpotDetailsPanel from '@/components/SpotDetailsPanel';
import ProfilePanel from '@/components/ProfilePanel';
import Toast from '@/components/Toast';
import { useUserStore } from '@/store/useUserStore';
import { useSpotStore } from '@/store/useSpotStore';
import { useToastStore } from '@/store/useToastStore';
import type { Spot } from '@/store/useSpotStore';

// Dynamic import to avoid SSR issues with Leaflet
const MapView = dynamic(
  () => import('@/components/MapView'),
  {
    ssr: false,
    loading: () => {
      return (
        <div className="w-full h-[100dvh] bg-slate-900 flex items-center justify-center">
          <div className="glass-card px-8 py-4">
            <p className="text-white font-medium">Loading map...</p>
          </div>
        </div>
      );
    },
  }
);

export default function Home() {
  const [isClient, setIsClient] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [addSpotModalOpen, setAddSpotModalOpen] = useState(false);
  const [profilePanelOpen, setProfilePanelOpen] = useState(false);
  const [isSelectingLocation, setIsSelectingLocation] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedSpot, setSelectedSpot] = useState<Spot | null>(null);
  
  const { user, initAuth } = useUserStore();
  const { spots, fetchSpots } = useSpotStore();
  const { toasts, removeToast } = useToastStore();

  useEffect(() => {
    setIsClient(true);
    // Initialize Firebase auth listener
    initAuth();
    // Fetch approved spots
    fetchSpots();
  }, [initAuth, fetchSpots]);

  const handleAddSpotClick = () => {
    if (user) {
      // Start location selection mode
      setIsSelectingLocation(true);
      setSelectedLocation(null);
    } else {
      setAuthModalOpen(true);
    }
  };

  const handleProfileClick = () => {
    if (user) {
      setProfilePanelOpen(true);
    } else {
      setAuthModalOpen(true);
    }
  };

  const handleLocationSelect = (location: { lat: number; lng: number }) => {
    setSelectedLocation(location);
    setIsSelectingLocation(false);
    // Automatically open the modal after location is selected
    setAddSpotModalOpen(true);
  };

  const handleAddSpotClose = () => {
    setAddSpotModalOpen(false);
    setSelectedLocation(null);
    setIsSelectingLocation(false);
  };

  if (!isClient) {
    return null;
  }

  return (
    <main className="relative w-full h-[100dvh] overflow-hidden">
      {/* Language Selector Modal */}
      <LanguageSelector />
      
      {/* Authentication Modal */}
      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
      
      {/* Add Spot Modal */}
      <AddSpotModal 
        isOpen={addSpotModalOpen} 
        onClose={handleAddSpotClose}
        selectedLocation={selectedLocation}
      />

      {/* Spot Details Panel */}
      <SpotDetailsPanel 
        spot={selectedSpot}
        onClose={() => setSelectedSpot(null)}
      />

      {/* Profile Panel */}
      <ProfilePanel 
        isOpen={profilePanelOpen}
        onClose={() => setProfilePanelOpen(false)}
      />
      
      {/* Full-screen map background */}
      <MapView 
        isAddingSpot={isSelectingLocation}
        onLocationSelect={handleLocationSelect}
        tempMarker={selectedLocation}
        spots={spots}
        onSpotDetailsOpen={setSelectedSpot}
      />
      
      {/* Empty state message */}
      {spots.length === 0 && !isSelectingLocation && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-10
          glass-card px-6 py-3 animate-fade-in pointer-events-none">
          <p className="text-white/80 text-sm text-center">
            🗺️ No spots found yet. Be the first to add one!
          </p>
        </div>
      )}

      {/* Location Selection Instructions */}
      {isSelectingLocation && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-10
          glass-card px-6 py-4 animate-fade-in max-w-sm">
          <p className="text-white font-semibold text-center mb-3">
            📍 Click on the map to select location
          </p>
          <button
            onClick={() => setIsSelectingLocation(false)}
            className="w-full py-2 rounded-xl glass-button text-white font-medium
              hover:bg-white/10 transition-all"
          >
            Cancel
          </button>
        </div>
      )}
      
      {/* Bottom Navigation - Floating Dock */}
      <BottomNavigation 
        onAddSpotClick={handleAddSpotClick}
        onProfileClick={handleProfileClick}
      />

      {/* Toast Notifications */}
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </main>
  );
}
