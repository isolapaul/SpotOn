'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState, useMemo } from 'react';
import BottomNavigation from '@/components/BottomNavigation';
import LanguageSelector from '@/components/LanguageSelector';
import AuthModal from '@/components/AuthModal';
import AddSpotModal from '@/components/AddSpotModal';
import SpotDetailsPanel from '@/components/SpotDetailsPanel';
import ProfilePanel from '@/components/ProfilePanel';
import FilterPanel from '@/components/FilterPanel';
import DistanceSelector from '@/components/DistanceSelector';
import DiscoveryPanel from '@/components/DiscoveryPanel';
import Toast from '@/components/Toast';
import LoadingScreen from '@/components/LoadingScreen';
import NotificationPrompt from '@/components/NotificationPrompt';
import NotificationCenter from '@/components/NotificationCenter';
import MapThemeSwitcher from '@/components/MapThemeSwitcher';
import UsernameSetupModal from '@/components/UsernameSetupModal';
import { useInstallGate } from '@/components/InstallGate';
import { useUserStore } from '@/store/useUserStore';
import { useSpotStore, isAdmin } from '@/store/useSpotStore';
import { useToastStore } from '@/store/useToastStore';
import { useLanguageStore } from '@/store/useLanguageStore';
import type { Spot } from '@/store/useSpotStore';

// Dynamic import to avoid SSR issues with Leaflet
const MapView = dynamic(
  () => import('@/components/MapView'),
  {
    ssr: false,
    loading: () => null, // No loading indicator here, we use LoadingScreen
  }
);

export default function Home() {
  // Check if InstallGate is blocking the app
  const { shouldBlock, isChecking } = useInstallGate();
  
  const [isClient, setIsClient] = useState(false);
  const [isAppReady, setIsAppReady] = useState(false);
  const [loadingStates, setLoadingStates] = useState({
    auth: false,
    spots: false,
    map: false,
  });
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [addSpotModalOpen, setAddSpotModalOpen] = useState(false);
  const [profilePanelOpen, setProfilePanelOpen] = useState(false);
  const [isSelectingLocation, setIsSelectingLocation] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedSpot, setSelectedSpot] = useState<Spot | null>(null);
  const [selectedDistance, setSelectedDistance] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [distanceSelectorOpen, setDistanceSelectorOpen] = useState(false);
  const [discoveryPanelOpen, setDiscoveryPanelOpen] = useState(false);
  
  const { user, needsUsername, setNeedsUsername, initAuth, initAdminListener } = useUserStore();
  const { spots, fetchSpots, unsubscribeSpots } = useSpotStore();
  const { toasts, removeToast } = useToastStore();
  const { t } = useLanguageStore();
  const { showToast } = useToastStore();

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
  }, [spots, userIsAdmin, selectedDistance, selectedCategory, userLocation]);

  // Check if all resources are loaded
  useEffect(() => {
    const allLoaded = loadingStates.auth && loadingStates.spots && loadingStates.map;
    if (allLoaded && !isAppReady) {
      // Small delay for smooth transition
      setTimeout(() => {
        setIsAppReady(true);
      }, 500);
    }
  }, [loadingStates, isAppReady]);

  useEffect(() => {
    // Don't initialize anything if InstallGate is blocking
    if (shouldBlock || isChecking) return;
    
    setIsClient(true);
    
    // Initialize Firebase auth listener
    const initializeAuth = async () => {
      await initAuth();
      setLoadingStates(prev => ({ ...prev, auth: true }));
    };
    
    // Initialize admin emails listener
    const unsubscribeAdmins = initAdminListener();
    
    // Fetch spots
    const initializeSpots = async () => {
      await fetchSpots();
      // Wait a bit to ensure spots are populated
      setTimeout(() => {
        setLoadingStates(prev => ({ ...prev, spots: true }));
      }, 300);
    };
    
    // Start both initializations in parallel
    initializeAuth();
    initializeSpots();
    
    // Get user's location (non-blocking)
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
    
    // Cleanup
    return () => {
      unsubscribeAdmins();
      // Clean up spots listener
      if (unsubscribeSpots) {
        unsubscribeSpots();
      }
    };
  }, [initAuth, initAdminListener, fetchSpots, unsubscribeSpots, shouldBlock, isChecking]);

  // Handle map load callback
  const handleMapLoad = () => {
    setLoadingStates(prev => ({ ...prev, map: true }));
  };

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

  const handleExploreClick = () => {
    setDiscoveryPanelOpen(true);
  };

  const handleDistanceSelect = (distance: number) => {
    if (!userLocation || visibleSpots.length === 0) return;
    
    // Filter spots within the selected distance
    const spotsInRange = visibleSpots.filter(spot => {
      const dist = calculateDistance(
        userLocation.lat,
        userLocation.lng,
        spot.location.lat,
        spot.location.lng
      );
      return dist <= distance;
    });

    if (spotsInRange.length === 0) {
      const msg = t('noSpotsInRange').replace('{distance}', String(distance));
      showToast(msg, 'error');
      return;
    }

    // Pick a random spot
    const randomSpot = spotsInRange[Math.floor(Math.random() * spotsInRange.length)];

    // Open Google Maps with directions
    const url = `https://www.google.com/maps/dir/?api=1&origin=${userLocation.lat},${userLocation.lng}&destination=${randomSpot.location.lat},${randomSpot.location.lng}`;
    window.open(url, '_blank');
  };

  if (!isClient) {
    return null;
  }

  return (
    <>
      {/* Loading Screen - shown until everything is ready */}
      <LoadingScreen isLoading={!isAppReady} />
      
      {/* Notification Prompt - shown after app loads */}
      <NotificationPrompt />
      
      {/* Notification Center - Top Left Button */}
      <NotificationCenter />
      
      {/* Map Theme Switcher - Top Right Button - PHASE 3 */}
      <MapThemeSwitcher />
      
      {/* Main App - hidden until ready, then fades in */}
      <main 
        className={`relative w-full h-[100dvh] overflow-hidden transition-opacity duration-700 ${
          isAppReady ? 'opacity-100' : 'opacity-0'
        }`}
      >
      {/* Language Selector Modal */}
      <LanguageSelector />
      
      {/* Filter Panel */}
      <FilterPanel 
        isOpen={filterPanelOpen}
        onClose={() => setFilterPanelOpen(false)}
        selectedDistance={selectedDistance}
        selectedCategory={selectedCategory}
        onDistanceChange={setSelectedDistance}
        onCategoryChange={setSelectedCategory}
        onClearFilters={handleClearFilters}
      />
      
      {/* Distance Selector Modal */}
      <DistanceSelector
        isOpen={distanceSelectorOpen}
        onClose={() => setDistanceSelectorOpen(false)}
        onSelect={handleDistanceSelect}
      />

      {/* Discovery Panel */}
      <DiscoveryPanel
        isOpen={discoveryPanelOpen}
        onClose={() => setDiscoveryPanelOpen(false)}
        userLocation={userLocation}
        onSpotSelect={(spot) => {
          setDiscoveryPanelOpen(false);
          setSelectedSpot(spot);
        }}
      />
      
      {/* Authentication Modal */}
      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
      
      {/* Username Setup Modal - shown after first login */}
      <UsernameSetupModal 
        isOpen={!!user && needsUsername} 
        onClose={() => setNeedsUsername(false)} 
      />
      
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
        onMapLoad={handleMapLoad}
        onMapClick={() => setSelectedSpot(null)}
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
            className="w-full py-3 px-4 rounded-xl glass-button text-white font-medium
              hover:bg-white/10 active:scale-95 transition-all touch-manipulation min-h-[48px]"
          >
            {t('cancel')}
          </button>
        </div>
      )}
      
      {/* Bottom Navigation - Floating Dock - PHASE 1: Simplified to 3 items */}
      <BottomNavigation 
        onAddSpotClick={handleAddSpotClick}
        onProfileClick={handleProfileClick}
        onExploreClick={handleExploreClick}
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
    </>
  );
}
