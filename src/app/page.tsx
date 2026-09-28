'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import BottomNavigation from '@/components/BottomNavigation';
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
import { useShallow } from 'zustand/react/shallow';
import { useUserStore } from '@/store/useUserStore';
import { useMapThemeStore } from '@/store/useMapThemeStore';
import { isSpotPanel, useUiStore } from '@/store/useUiStore';
import { useT } from '@/hooks/useT';
import { useAppBootstrap } from '@/hooks/useAppBootstrap';
import { useInitialLanguage } from '@/hooks/useInitialLanguage';
import { useVisibleSpots } from '@/hooks/useVisibleSpots';
import { useUserLocation } from '@/hooks/useUserLocation';
import { DEFAULT_MAP_CENTER } from '@/lib/constants';

// Dynamic import to avoid SSR issues with Leaflet
const MapView = dynamic(() => import('@/components/MapView'), {
  ssr: false,
  loading: () => null, // No loading indicator here, we use LoadingScreen
});

export default function Home() {
  const [isClient, setIsClient] = useState(false);
  const { isAppReady, onMapLoad } = useAppBootstrap();
  useInitialLanguage();
  const visibleSpots = useVisibleSpots();
  const { location: userLocation, status: locationStatus } = useUserLocation();
  const { user, needsUsername, setNeedsUsername } = useUserStore();
  const t = useT();

  const activePanel = useUiStore((s) => s.activePanel);
  const selectingLocation = useUiStore((s) => s.selectingLocation);
  const pendingLocation = useUiStore((s) => s.pendingLocation);
  const movedBannerVisible = useUiStore((s) => s.movedBannerVisible);
  const { openPanel, closePanel, startSelectingLocation, cancelSelectingLocation, selectLocation, closeAddSpot, onMapClick } =
    useUiStore(useShallow(({ openPanel, closePanel, startSelectingLocation, cancelSelectingLocation, selectLocation, closeAddSpot, onMapClick }) =>
      ({ openPanel, closePanel, startSelectingLocation, cancelSelectingLocation, selectLocation, closeAddSpot, onMapClick })));

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Map: the shared location, or the default centre once location is denied (dot + one-time pan).
  const mapLocation = userLocation
    ?? (locationStatus === 'denied' ? { lat: DEFAULT_MAP_CENTER[0], lng: DEFAULT_MAP_CENTER[1] } : null);
  const spotId = isSpotPanel(activePanel) ? activePanel.spotId : null;
  // Top buttons are hidden while a full-screen panel covers the map.
  const panelCoversMap = activePanel === 'profile' || activePanel === 'discovery' || spotId !== null;

  const handleAddSpotClick = () => {
    // Pick the location on the satellite map for accuracy (signed in only)
    if (user) startSelectingLocation(useMapThemeStore.getState().theme);
    else openPanel('auth');
  };

  if (!isClient) return null;

  return (
    <>
      {/* Loading Screen - shown until everything is ready */}
      <LoadingScreen isLoading={!isAppReady} />
      {/* Notification Prompt - shown after app loads */}
      <NotificationPrompt />
      {/* Top Buttons - Hidden when modals are open */}
      {!panelCoversMap && (
        <>
          {/* Notification Center - Top Left Button */}
          <NotificationCenter />
          {/* Map Theme Switcher - Top Right Button - PHASE 3 */}
          <MapThemeSwitcher />
          {/* Domain-move notice (Vercel build only, T19) - one row below the top buttons */}
          {isAppReady && !selectingLocation && <MovedBanner />}
        </>
      )}
      {/* Main App - hidden until ready, then fades in */}
      <main
        className={`relative w-full h-[100dvh] overflow-hidden transition-opacity duration-700 ${
          isAppReady ? 'opacity-100' : 'opacity-0'
        }`}
      >
      {/* Discovery Panel */}
      <DiscoveryPanel
        isOpen={activePanel === 'discovery'}
        onClose={closePanel}
        userLocation={userLocation}
        onSpotSelect={(spot) => openPanel({ type: 'spot', spotId: spot.id })}
      />
      {/* Authentication Modal */}
      <AuthModal isOpen={activePanel === 'auth'} onClose={closePanel} />
      {/* Username Setup Modal - shown after first login */}
      <UsernameSetupModal isOpen={!!user && needsUsername} onClose={() => setNeedsUsername(false)} />
      {/* Add Spot Modal */}
      <AddSpotModal isOpen={activePanel === 'addSpot'} onClose={closeAddSpot} selectedLocation={pendingLocation} />
      {/* Spot Details Panel */}
      <SpotDetailsPanel spotId={spotId} onClose={closePanel} />
      {/* Profile Panel */}
      <ProfilePanel isOpen={activePanel === 'profile'} onClose={closePanel} />
      {/* Full-screen map background */}
      <MapView
        isAddingSpot={selectingLocation}
        onLocationSelect={selectLocation}
        tempMarker={pendingLocation}
        spots={visibleSpots}
        userLocation={mapLocation}
        onSpotDetailsOpen={(spot) => openPanel({ type: 'spot', spotId: spot.id })}
        onMapLoad={onMapLoad}
        onMapClick={onMapClick}
      />
      {/* Empty state message (shares its slot with the move banner) */}
      {visibleSpots.length === 0 && !selectingLocation && !movedBannerVisible && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-10
          glass-card px-6 py-3 animate-fade-in pointer-events-none">
          <p className="text-white/80 text-sm text-center">
            {t('noSpotsFound')}
          </p>
        </div>
      )}
      {/* Location Selection Instructions (the only "click the map" banner, DUP-15) */}
      {selectingLocation && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-10
          glass-card px-6 py-4 animate-fade-in max-w-sm">
          <p className="text-white font-semibold text-center mb-3">
            {t('clickMapToSelect')}
          </p>
          <button
            onClick={cancelSelectingLocation}
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
        onProfileClick={() => openPanel(user ? 'profile' : 'auth')}
        onExploreClick={() => openPanel('discovery')}
      />
      </main>
    </>
  );
}
