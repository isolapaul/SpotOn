'use client';

import dynamic from 'next/dynamic';
import BottomNavigation from '@/components/BottomNavigation';
import AuthModal from '@/components/AuthModal';
import AddSpotModal from '@/components/AddSpotModal';
import SpotDetailsPanel from '@/components/SpotDetailsPanel';
import ProfilePanel from '@/components/ProfilePanel';
import UserProfilePanel from '@/components/UserProfilePanel';
import DiscoveryPanel from '@/components/DiscoveryPanel';
import FeedPanel from '@/components/feed/FeedPanel';
import LiveNotice from '@/components/notifications/LiveNotice';
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
import { hasBackStep, isSpotPanel, isUserPanel, useUiStore, type ReturnTarget } from '@/store/useUiStore';
import { useT } from '@/hooks/useT';
import { useAppBootstrap } from '@/hooks/useAppBootstrap';
import { useIsClient } from '@/hooks/useIsClient';
import { useInitialLanguage } from '@/hooks/useInitialLanguage';
import { useMapThemeAttribute } from '@/hooks/useMapThemeAttribute';
import { useStandaloneFullHeight } from '@/hooks/useStandaloneFullHeight';
import { useSystemBack } from '@/hooks/useSystemBack';
import { useRelocateSpot } from '@/hooks/useRelocateSpot';
import { runViewTransition } from '@/hooks/viewTransition';
import { useVisibleSpots } from '@/hooks/useVisibleSpots';
import { useUserLocation } from '@/hooks/useUserLocation';
import { useSpotLink } from '@/hooks/useSpotLink';
import { useOnboardingGate } from '@/hooks/useOnboardingGate';
import { usePendingUsernameClaim } from '@/hooks/usePendingUsernameClaim';
import { useOnboardingStore } from '@/store/useOnboardingStore';
import { useMemo } from 'react';
import { DEFAULT_MAP_CENTER, Z } from '@/lib/constants';

// Client-only: mapbox-gl needs `window` and WebGL
const MapView = dynamic(() => import('@/components/MapView'), {
  ssr: false,
  loading: () => null, // No loading indicator here, we use LoadingScreen
});

// The first-run tour: its own chunk, downloaded only while it is due (never again once completed).
const OnboardingFlow = dynamic(() => import('@/components/onboarding/OnboardingFlow'), {
  ssr: false,
  loading: () => <div className={`fixed inset-0 ${Z.onboarding} bg-[#1b1c1e]`} aria-hidden="true" />,
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
  // First-run tour: the other first-run prompts wait while it is due or open (they show after it).
  const { showTour, blocking: tourBlocking } = useOnboardingGate();
  usePendingUsernameClaim();
  const pendingUsername = useOnboardingStore((s) => s.pendingUsername);
  const claimingUsername = useOnboardingStore((s) => s.claiming);

  const activePanel = useUiStore((s) => s.activePanel);
  const selectingLocation = useUiStore((s) => s.selectingLocation);
  const pendingLocation = useUiStore((s) => s.pendingLocation);
  const movedBannerVisible = useUiStore((s) => s.movedBannerVisible);
  const previewSpotId = useUiStore((s) => s.previewSpotId);
  const locateRequest = useUiStore((s) => s.locateRequest);
  const returnTo = useUiStore((s) => s.returnTo);
  const focusRequest = useUiStore((s) => s.focusRequest);
  const canGoBack = useUiStore(hasBackStep);
  const { openPanel, closePanel, startSelectingLocation, cancelSelectingLocation, selectLocation, closeAddSpot, onMapClick, previewSpot } =
    useUiStore(useShallow(({ openPanel, closePanel, startSelectingLocation, cancelSelectingLocation, selectLocation, closeAddSpot, onMapClick, previewSpot }) =>
      ({ openPanel, closePanel, startSelectingLocation, cancelSelectingLocation, selectLocation, closeAddSpot, onMapClick, previewSpot })));
  const { openSpotFromList, arriveAtSpot, closeSpot, goBack, finishRelocating } = useUiStore(useShallow(
    ({ openSpotFromList, arriveAtSpot, closeSpot, goBack, finishRelocating }) => ({ openSpotFromList, arriveAtSpot, closeSpot, goBack, finishRelocating })));
  const relocatingSpotId = useUiStore((s) => s.relocatingSpotId);
  const relocateSpot = useRelocateSpot();

  // Map: the shared location, or the default centre once location is denied (dot + one-time pan).
  const mapLocation = userLocation
    ?? (locationStatus === 'denied' ? { lat: DEFAULT_MAP_CENTER[0], lng: DEFAULT_MAP_CENTER[1] } : null);
  const spotId = isSpotPanel(activePanel) ? activePanel.spotId : null;
  // The place card follows the live spot (a deleted or hidden spot closes it).
  const previewedSpot = previewSpotId ? (visibleSpots.find((s) => s.id === previewSpotId) ?? null) : null;
  const approvedCount = visibleSpots.filter((s) => s.status === 'approved').length;
  // A shared link (/spot/<id>) opens its spot once the app is ready.
  const visibleIds = useMemo(() => new Set(visibleSpots.map((s) => s.id)), [visibleSpots]);
  useSpotLink(isAppReady, visibleIds);

  // Full-screen panels open and close as sheets; the place card's Details morphs its photo into the hero.
  const openSheet = (p: Parameters<typeof openPanel>[0]) => runViewTransition(() => openPanel(p));
  const closeSheet = () => runViewTransition(closePanel);
  const openFromList = (spotId: string, from: ReturnTarget) => runViewTransition(() => openSpotFromList(spotId, from));
  const back = () => runViewTransition(goBack);
  // The system back steps back in the app (Android back gesture, browser Back) while anything is open.
  useSystemBack(canGoBack, `${JSON.stringify(activePanel)}|${previewSpotId}`, back);
  // The way back to the list a spot was opened from (the details, and the place card for the profile).
  const backToList = returnTo
    ? {
        label: t(returnTo === 'discovery' ? 'explore' : returnTo === 'feed' ? 'feedTitle' : 'profile'),
        ariaLabel: t(returnTo === 'discovery' ? 'backToExplore' : returnTo === 'feed' ? 'backToFeed' : 'backToProfile'),
        onBack: back,
      }
    : undefined;
  // The card keeps the way back to a profile (own or someone's); Explore opens the details instead.
  const cardBack = returnTo && returnTo !== 'discovery' ? backToList : undefined;

  // A tap on the map while picking: a new spot's place, or the edited spot's new location (item 4).
  const handleLocationSelect = (location: { lat: number; lng: number }) => {
    if (!relocatingSpotId) return selectLocation(location);
    finishRelocating();
    void relocateSpot(relocatingSpotId, location);
  };

  const handleAddSpotClick = () => {
    // Pick the location on the satellite map for accuracy (signed in only)
    if (user) startSelectingLocation(useMapThemeStore.getState().theme);
    else openPanel('auth');
  };

  if (!isClient) return null;

  return (
    <>
      {/* Loading Screen - shown until everything is ready */}
      <LoadingScreen isLoading={!isAppReady && !showTour} />
      {/* Notification Prompt - shown after app loads (never during the tour) */}
      {!tourBlocking && <NotificationPrompt />}
      {/* Background uploads (G4): above panels too, so a review sent from a spot panel reports back */}
      <UploadStatus />
      {/* A notice arriving while the app is open (new follower, followed user's spot) drops in on top */}
      {!tourBlocking && <LiveNotice />}
      {/* Level-up moment: over everything, whenever the own XP level goes up */}
      {!tourBlocking && <LevelUpCelebration />}
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
        inert={showTour}
        className={`fixed inset-0 w-full overflow-hidden transition-opacity duration-700 ${
          isAppReady ? 'opacity-100' : 'opacity-0'
        }`}
      >
      {/* Discovery Panel */}
      <DiscoveryPanel
        isOpen={activePanel === 'discovery'}
        onClose={closeSheet}
        userLocation={userLocation}
        onSpotSelect={(spot) => openFromList(spot.id, 'discovery')}
      />
      {/* The following feed */}
      <FeedPanel
        isOpen={activePanel === 'feed'}
        onClose={closeSheet}
        userLocation={userLocation}
        onShowOnMap={(id) => openFromList(id, 'feed')}
      />
      {/* Authentication Modal */}
      <AuthModal isOpen={activePanel === 'auth'} onClose={closePanel} />
      {/* Username Setup Modal - shown after first login; after the tour, prefilled with the name chosen there */}
      <UsernameSetupModal
        key={pendingUsername ?? ''}
        initialUsername={pendingUsername ?? undefined}
        isOpen={!!user && needsUsername && !tourBlocking && !claimingUsername}
        onClose={() => setNeedsUsername(false)}
      />
      {/* One-time terms acceptance for users who signed up before the terms (A1); after the tour */}
      <TermsPrompt ready={isAppReady && !tourBlocking} />
      {/* Add Spot Modal */}
      <AddSpotModal isOpen={activePanel === 'addSpot'} onClose={closeAddSpot} selectedLocation={pendingLocation} />
      {/* Spot Details Panel */}
      <SpotDetailsPanel spotId={spotId} onClose={() => runViewTransition(closeSpot)} back={backToList} />
      {/* Someone's profile page (item 8) */}
      <UserProfilePanel
        uid={isUserPanel(activePanel) ? activePanel.uid : null}
        onClose={back}
        onOpenSpot={(id) => isUserPanel(activePanel) && openFromList(id, activePanel)}
      />
      {/* Profile Panel */}
      <ProfilePanel isOpen={activePanel === 'profile'} onClose={closeSheet} onOpenSpot={(id) => openFromList(id, 'profile')} />
      {/* Full-screen map background */}
      <MapView
        isAddingSpot={selectingLocation}
        onLocationSelect={handleLocationSelect}
        tempMarker={pendingLocation}
        spots={visibleSpots}
        userLocation={mapLocation}
        locateRequest={locateRequest}
        selectedSpotId={previewedSpot?.id ?? null}
        onSpotPreview={previewSpot}
        onMapLoad={onMapLoad}
        onMapClick={onMapClick}
        focusRequest={focusRequest}
        onSpotArrive={arriveAtSpot}
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
        back={cardBack}
      />
      {/* Launcher (design 1C) */}
      <BottomNavigation
        picking={selectingLocation}
        pickingHint={relocatingSpotId ? 'tapNewLocation' : undefined}
        hidden={previewedSpot !== null}
        spotCount={approvedCount}
        onExplore={() => openSheet('discovery')}
        onFeed={() => openSheet('feed')}
        onAdd={handleAddSpotClick}
        onProfile={() => (user ? openSheet('profile') : openPanel('auth'))}
        onCancelPicking={cancelSelectingLocation}
      />
      </main>
      {showTour && <OnboardingFlow />}
    </>
  );
}
