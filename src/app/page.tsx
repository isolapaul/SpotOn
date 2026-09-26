'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState, useMemo } from 'react';
import BottomNavigation from '@/components/BottomNavigation';
import LanguageSelector from '@/components/LanguageSelector';
import AuthModal from '@/components/AuthModal';
import AddSpotModal from '@/components/AddSpotModal';
import SpotDetailsPanel from '@/components/SpotDetailsPanel';
import ProfilePanel from '@/components/ProfilePanel';
import DiscoveryPanel from '@/components/DiscoveryPanel';
import LoadingScreen from '@/components/LoadingScreen';
import NotificationPrompt from '@/components/NotificationPrompt';
import NotificationCenter from '@/components/NotificationCenter';
import MapThemeSwitcher from '@/components/MapThemeSwitcher';
import UsernameSetupModal from '@/components/UsernameSetupModal';
import MovedBanner from '@/components/MovedBanner';
import { useUserStore } from '@/store/useUserStore';
import { useMapThemeStore, type MapTheme } from '@/store/useMapThemeStore';
import { useSpotStore } from '@/store/useSpotStore';
import { useLanguageStore } from '@/store/useLanguageStore';
import { useUiStore } from '@/store/useUiStore';
import type { Spot } from '@/store/useSpotStore';
import { DELAYS } from '@/lib/constants';

// Dynamic import to avoid SSR issues with Leaflet
const MapView = dynamic(
  () => import('@/components/MapView'),
  {
    ssr: false,
    loading: () => null, // No loading indicator here, we use LoadingScreen
  }
);

export default function Home() {
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
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [discoveryPanelOpen, setDiscoveryPanelOpen] = useState(false);
  
  const { user, needsUsername, setNeedsUsername, initAuth } = useUserStore();
  const { theme: currentMapTheme, setTheme } = useMapThemeStore();
  const { spots, fetchSpots } = useSpotStore();
  const { t } = useLanguageStore();
  const movedBannerVisible = useUiStore((s) => s.movedBannerVisible);

  const [prevMapTheme, setPrevMapTheme] = useState<MapTheme | null>(null);

  // Check if current user is admin
  const userIsAdmin = useUserStore((s) => s.isAdmin);

  // Filter spots based on user role: admins see all spots, everyone else only approved ones
  const visibleSpots = useMemo(
    () => (userIsAdmin ? spots : spots.filter(spot => spot.status === 'approved')),
    [spots, userIsAdmin],
  );

  // Check if all resources are loaded
  useEffect(() => {
    const allLoaded = loadingStates.auth && loadingStates.spots && loadingStates.map;
    if (allLoaded && !isAppReady) {
      // Small delay for smooth transition
      const id = setTimeout(() => {
        setIsAppReady(true);
      }, DELAYS.appReady);
      return () => clearTimeout(id);
    }
  }, [loadingStates, isAppReady]);

  useEffect(() => {
    setIsClient(true);
    let spotsTimer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    
    // Initialize Firebase auth listener
    const initializeAuth = async () => {
      await initAuth();
      setLoadingStates(prev => ({ ...prev, auth: true }));
    };
    
    // Fetch spots
    const initializeSpots = async () => {
      await fetchSpots();
      if (cancelled) return;
      // Wait a bit to ensure spots are populated
      spotsTimer = setTimeout(() => {
        setLoadingStates(prev => ({ ...prev, spots: true }));
      }, DELAYS.spotsSettle);
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
      cancelled = true;
      clearTimeout(spotsTimer);
      // Clean up spots listener: read it at cleanup time (the render-time value is always null)
      const unsub = useSpotStore.getState().unsubscribeSpots;
      if (unsub) {
        unsub();
        useSpotStore.setState({ unsubscribeSpots: null });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle map load callback
  const handleMapLoad = () => {
    setLoadingStates(prev => ({ ...prev, map: true }));
  };

  const handleAddSpotClick = () => {
    if (user) {
      // Start location selection mode and switch to satellite map for accuracy
      setPrevMapTheme(currentMapTheme);
      setTheme('satellite');
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

  const handleCancelSelecting = () => {
    setIsSelectingLocation(false);
    // Restore previous theme if we switched to satellite
    if (prevMapTheme) {
      setTheme(prevMapTheme);
      setPrevMapTheme(null);
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
    // Restore previous map theme if we changed it for adding
    if (prevMapTheme) {
      setTheme(prevMapTheme);
      setPrevMapTheme(null);
    }
  };

  const handleExploreClick = () => {
    setDiscoveryPanelOpen(true);
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
      
      {/* Top Buttons - Hidden when modals are open */}
      {!profilePanelOpen && !discoveryPanelOpen && !selectedSpot && (
        <>
          {/* Notification Center - Top Left Button */}
          <NotificationCenter />
          
          {/* Map Theme Switcher - Top Right Button - PHASE 3 */}
          <MapThemeSwitcher />

          {/* Domain-move notice (Vercel build only, T19) - one row below the top buttons */}
          {isAppReady && !isSelectingLocation && <MovedBanner />}
        </>
      )}
      
      {/* Main App - hidden until ready, then fades in */}
      <main 
        className={`relative w-full h-[100dvh] overflow-hidden transition-opacity duration-700 ${
          isAppReady ? 'opacity-100' : 'opacity-0'
        }`}
      >
      {/* Language Selector Modal */}
      <LanguageSelector />

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
      
      {/* Empty state message (shares its slot with the move banner) */}
      {visibleSpots.length === 0 && !isSelectingLocation && !movedBannerVisible && (
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
            onClick={handleCancelSelecting}
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

      {/* Toast notifications are now redirected silently to NotificationCenter */}
      </main>
    </>
  );
}
