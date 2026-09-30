'use client';

import dynamic from 'next/dynamic';
import BottomNavigation from '@/components/BottomNavigation';
import AuthModal from '@/components/AuthModal';
import AddSpotModal from '@/components/AddSpotModal';
import SpotDetailsPanel from '@/components/SpotDetailsPanel';
import ProfilePanel from '@/components/ProfilePanel';
import DiscoveryPanel from '@/components/DiscoveryPanel';
import LoadingScreen from '@/components/LoadingScreen';
import NotificationPrompt from '@/components/NotificationPrompt';
import UploadStatus from '@/components/UploadStatus';
import MapControls from '@/components/map/MapControls';
import PlaceCard from '@/components/map/PlaceCard';
import LevelUpCelebration from '@/components/LevelUpCelebration';
import UsernameSetupModal from '@/components/UsernameSetupModal';
import TermsPrompt from '@/components/legal/TermsPrompt';
import MovedBanner from '@/components/MovedBanner';
import { useShallow } from 'zustand/react/shallow';
import { useUserStore } from '@/store/useUserStore';
import { useMapThemeStore } from '@/store/useMapThemeStore';
import { isSpotPanel, useUiStore } from '@/store/useUiStore';
import { useT } from '@/hooks/useT';
import { useAppBootstrap } from '@/hooks/useAppBootstrap';
import { useIsClient } from '@/hooks/useIsClient';
import { useInitialLanguage } from '@/hooks/useInitialLanguage';
import { useMapThemeAttribute } from '@/hooks/useMapThemeAttribute';
import { useStandaloneFullHeight } from '@/hooks/useStandaloneFullHeight';
import { runViewTransition } from '@/hooks/viewTransition';
import { useVisibleSpots } from '@/hooks/useVisibleSpots';
import { useUserLocation } from '@/hooks/useUserLocation';
import { DEFAULT_MAP_CENTER } from '@/lib/constants';

// Dynamic import to avoid SSR issues with Leaflet
const MapView = dynamic(() => import('@/components/MapView'), {
  ssr: false,
  loading: () => null, // No loading indicator here, we use LoadingScreen
});

export default function Home() {
  const isClient = useIsClient();
  const { isAppReady, onMapLoad } = useAppBootstrap();
  useInitialLanguage();
  useMapThemeAttribute();
  useStandaloneFullHeight();
  const visibleSpots = useVisibleSpots();
  const { location: userLocation, status: locationStatus } = useUserLocation();
  const { user, needsUsername, setNeedsUsername } = useUserStore();
  const t = useT();

  const activePanel = useUiStore((s) => s.activePanel);
  const selectingLocation = useUiStore((s) => s.selectingLocation);
  const pendingLocation = useUiStore((s) => s.pendingLocation);
  const movedBannerVisible = useUiStore((s) => s.movedBannerVisible);
  const previewSpotId = useUiStore((s) => s.previewSpotId);
  const locateRequest = useUiStore((s) => s.locateRequest);
  const { openPanel, closePanel, startSelectingLocation, cancelSelectingLocation, selectLocation, closeAddSpot, onMapClick, previewSpot } =
    useUiStore(useShallow(({ openPanel, closePanel, startSelectingLocation, cancelSelectingLocation, selectLocation, closeAddSpot, onMapClick, previewSpot }) =>
      ({ openPanel, closePanel, startSelectingLocation, cancelSelectingLocation, selectLocation, closeAddSpot, onMapClick, previewSpot })));

  // Map: the shared location, or the default centre once location is denied (dot + one-time pan).
  const mapLocation = userLocation
    ?? (locationStatus === 'denied' ? { lat: DEFAULT_MAP_CENTER[0], lng: DEFAULT_MAP_CENTER[1] } : null);
  const spotId = isSpotPanel(activePanel) ? activePanel.spotId : null;
  // The place card follows the live spot (a deleted or hidden spot closes it).
  const previewedSpot = previewSpotId ? (visibleSpots.find((s) => s.id === previewSpotId) ?? null) : null;
  const approvedCount = visibleSpots.filter((s) => s.status === 'approved').length;

  // Full-screen panels open and close as sheets; the place card's Details morphs its photo into the hero.
  const openSheet = (p: Parameters<typeof openPanel>[0]) => runViewTransition(() => openPanel(p));
  const closeSheet = () => runViewTransition(closePanel);

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
      {/* Background uploads (G4): above panels too, so a review sent from a spot panel reports back */}
      <UploadStatus />
      {/* Level-up moment: over everything, whenever the own spot count crosses a level */}
      <LevelUpCelebration />
      {/* Top-right control stack (design 1C); only over the bare map: it lives outside <main>, so it
          would sit above any panel or modal (the sign-in sheet showed it on top) */}
      {activePanel === 'none' && isAppReady && (
        <>
          <MapControls />
          {/* Domain-move notice (Vercel build only, T19): the free top-left slot */}
          {!selectingLocation && <MovedBanner />}
        </>
      )}
      {/* Main App - hidden until ready, then fades in */}
      <main
        className={`fixed inset-0 w-full overflow-hidden transition-opacity duration-700 ${
          isAppReady ? 'opacity-100' : 'opacity-0'
        }`}
      >
      {/* Discovery Panel */}
      <DiscoveryPanel
        isOpen={activePanel === 'discovery'}
        onClose={closeSheet}
        userLocation={userLocation}
        onSpotSelect={(spot) => openSheet({ type: 'spot', spotId: spot.id })}
      />
      {/* Authentication Modal */}
      <AuthModal isOpen={activePanel === 'auth'} onClose={closePanel} />
      {/* Username Setup Modal - shown after first login */}
      <UsernameSetupModal isOpen={!!user && needsUsername} onClose={() => setNeedsUsername(false)} />
      {/* One-time terms acceptance for users who signed up before the terms (A1) */}
      <TermsPrompt ready={isAppReady} />
      {/* Add Spot Modal */}
      <AddSpotModal isOpen={activePanel === 'addSpot'} onClose={closeAddSpot} selectedLocation={pendingLocation} />
      {/* Spot Details Panel */}
      <SpotDetailsPanel spotId={spotId} onClose={closeSheet} />
      {/* Profile Panel */}
      <ProfilePanel isOpen={activePanel === 'profile'} onClose={closeSheet} />
      {/* Full-screen map background */}
      <MapView
        isAddingSpot={selectingLocation}
        onLocationSelect={selectLocation}
        tempMarker={pendingLocation}
        spots={visibleSpots}
        userLocation={mapLocation}
        locateRequest={locateRequest}
        selectedSpotId={previewedSpot?.id ?? null}
        onSpotPreview={previewSpot}
        onMapLoad={onMapLoad}
        onMapClick={onMapClick}
      />
      {/* Empty state (shares the top-left slot with the move banner) */}
      {visibleSpots.length === 0 && !selectingLocation && !movedBannerVisible && (
        <div
          className="material-chrome absolute z-10 rounded-2xl px-4 py-3 animate-fade-in pointer-events-none"
          style={{
            top: 'calc(env(safe-area-inset-top) + 8px)',
            left: 'max(12px, calc(env(safe-area-inset-left) + 8px))',
            right: 'calc(max(12px, calc(env(safe-area-inset-right) + 8px)) + 52px)',
          }}
        >
          <p className="text-chrome-ink text-[15px] leading-snug">{t('noSpotsFound')}</p>
        </div>
      )}
      {/* Place card (design 1E) */}
      <PlaceCard
        spot={previewedSpot}
        userLocation={userLocation}
        onClose={() => previewSpot(null)}
        onDetails={(spot) => runViewTransition(() => openPanel({ type: 'spot', spotId: spot.id }), 'morph')}
      />
      {/* Launcher (design 1C) */}
      <BottomNavigation
        picking={selectingLocation}
        hidden={previewedSpot !== null}
        spotCount={approvedCount}
        onExplore={() => openSheet('discovery')}
        onAdd={handleAddSpotClick}
        onProfile={() => (user ? openSheet('profile') : openPanel('auth'))}
        onCancelPicking={cancelSelectingLocation}
      />
      </main>
    </>
  );
}
