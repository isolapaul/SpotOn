'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import BottomNavigation from '@/components/BottomNavigation';
import LanguageSelector from '@/components/LanguageSelector';
import AuthModal from '@/components/AuthModal';
import AddSpotModal from '@/components/AddSpotModal';
import SpotDetailsPanel from '@/components/SpotDetailsPanel';
import ProfilePanel from '@/components/ProfilePanel';
import FilterPanel from '@/components/FilterPanel';
import Toast from '@/components/Toast';
import { useUserStore } from '@/store/useUserStore';
import { useSpotStore, isAdmin } from '@/store/useSpotStore';
import { useToastStore } from '@/store/useToastStore';
import { useLanguageStore } from '@/store/useLanguageStore';
import type { Spot } from '@/store/useSpotStore';
import { useMemo } from 'react';

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
  const [selectedDistance, setSelectedDistance] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  
  const { user, initAuth } = useUserStore();
  const { spots, fetchSpots } = useSpotStore();
  const { toasts, removeToast } = useToastStore();
  const { t } = useLanguageStore();

  // Check if current user is admin
  const userIsAdmin = useMemo(() => isAdmin(user?.email), [user?.email]);

  // Calculate distance between two coordinates (Haversine formula)
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Filter spots based on user role, distance, and category
  const visibleSpots = useMemo(() => {
    let filtered = userIsAdmin 
      ? spots // Admins see ALL spots (approved + pending)
      : spots.filter(spot => spot.status === 'approved'); // Regular users see only approved spots

    // Filter by distance if selected and user location is available
    if (selectedDistance !== null && userLocation) {
      filtered = filtered.filter(spot => {
        const distance = calculateDistance(
          userLocation.lat,
          userLocation.lng,
          spot.location.lat,
          spot.location.lng
        );
        return distance <= selectedDistance;
      });
    }

    // Filter by category if selected
    if (selectedCategory !== null) {
      filtered = filtered.filter(spot => spot.category === selectedCategory);
    }

    return filtered;
    return filtered;
  }, [spots, userIsAdmin, selectedDistance, selectedCategory, userLocation]);

  useEffect(() => {
    setIsClient(true);
    // Initialize Firebase auth listener
    initAuth();
    // Fetch approved spots
    fetchSpots();
    
    // Get user's location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.log('Location access denied or unavailable:', error);
        }
      );
    }
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

  const handleClearFilters = () => {
    setSelectedDistance(null);
    setSelectedCategory(null);
  };

  if (!isClient) {
    return null;
  }

  return (
    <main className="relative w-full h-[100dvh] overflow-hidden">
      {/* Language Selector Modal */}
      <LanguageSelector />
      
      {/* Filter Panel */}
      <FilterPanel 
        selectedDistance={selectedDistance}
        selectedCategory={selectedCategory}
        onDistanceChange={setSelectedDistance}
        onCategoryChange={setSelectedCategory}
        onClearFilters={handleClearFilters}
      />
      
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
        isAdmin={userIsAdmin}
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
        spots={visibleSpots}
        isAdmin={userIsAdmin}
        onSpotDetailsOpen={setSelectedSpot}
      />
      
      {/* Empty state message */}
      {visibleSpots.length === 0 && !isSelectingLocation && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-10
          glass-card px-6 py-3 animate-fade-in pointer-events-none">
          <p className="text-white/80 text-sm text-center">
            {t('noSpotsFound')}
          </p>
        </div>
      )}

      {/* Location Selection Instructions */}
      {isSelectingLocation && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-10
          glass-card px-6 py-4 animate-fade-in max-w-sm">
          <p className="text-white font-semibold text-center mb-3">
            {t('clickMapToSelect')}
          </p>
          <button
            onClick={() => setIsSelectingLocation(false)}
            className="w-full py-2 rounded-xl glass-button text-white font-medium
              hover:bg-white/10 transition-all"
          >
            {t('cancel')}
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
