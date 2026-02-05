'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import BottomNavigation from '@/components/BottomNavigation';
import LanguageSelector from '@/components/LanguageSelector';
import AuthModal from '@/components/AuthModal';
import AddSpotModal from '@/components/AddSpotModal';
import { useUserStore } from '@/store/useUserStore';
import { useSpotStore } from '@/store/useSpotStore';

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
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);
  
  const { user, initAuth } = useUserStore();
  const { spots, fetchSpots } = useSpotStore();

  useEffect(() => {
    setIsClient(true);
    // Initialize Firebase auth listener
    initAuth();
    // Fetch approved spots
    fetchSpots();
  }, [initAuth, fetchSpots]);

  const handleAddSpotClick = () => {
    if (user) {
      setAddSpotModalOpen(true);
    } else {
      setAuthModalOpen(true);
    }
  };

  const handleProfileClick = () => {
    if (user) {
      // Open profile panel in Phase 3
      console.log('Open profile for:', user.name);
    } else {
      setAuthModalOpen(true);
    }
  };

  const handleLocationSelect = (location: { lat: number; lng: number }) => {
    setSelectedLocation(location);
  };

  const handleAddSpotClose = () => {
    setAddSpotModalOpen(false);
    setSelectedLocation(null);
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
      
      {/* Full-screen map background */}
      <MapView 
        isAddingSpot={addSpotModalOpen}
        onLocationSelect={handleLocationSelect}
        tempMarker={selectedLocation}
        spots={spots}
      />
      
      {/* Empty state message */}
      {spots.length === 0 && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-10
          glass-card px-6 py-3 animate-fade-in pointer-events-none">
          <p className="text-white/80 text-sm text-center">
            🗺️ No spots found yet. Be the first to add one!
          </p>
        </div>
      )}
      
      {/* Bottom Navigation - Floating Dock */}
      <BottomNavigation 
        onAddSpotClick={handleAddSpotClick}
        onProfileClick={handleProfileClick}
      />
    </main>
  );
}
