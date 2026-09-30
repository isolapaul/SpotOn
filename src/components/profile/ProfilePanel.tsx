'use client';

import { useMemo, useState } from 'react';
import { useUserStore } from '@/store/useUserStore';
import { useSpotStore } from '@/store/useSpotStore';
import { useModerationStore } from '@/store/useModerationStore';
import { useIsAdmin, useIsSuperAdmin } from '@/hooks/useIsAdmin';
import { useCategories } from '@/hooks/useCategories';
import { useMyLevel } from '@/hooks/useMyLevel';
import SettingsPanel from '../SettingsPanel';
import PanelShell from '../ui/PanelShell';
import ProfileBanner from './ProfileBanner';
import ProfileHeader from './ProfileHeader';
import ProfileTabs, { type ProfileTab } from './ProfileTabs';
import LevelInfoModal from './LevelInfoModal';
import MySpotsTab from './tabs/MySpotsTab';
import FavoritesTab from './tabs/FavoritesTab';
import PendingTab from './tabs/PendingTab';
import AdminTab from './tabs/AdminTab';

interface ProfilePanelProps {
  isOpen: boolean;
  onClose: () => void;
  /** A spot card was tapped: the profile closes and the map flies to the spot. */
  onOpenSpot: (spotId: string) => void;
}

export default function ProfilePanel({ isOpen, onClose, onOpenSpot }: Readonly<ProfilePanelProps>) {
  const user = useUserStore((s) => s.user);
  const spots = useSpotStore((s) => s.spots);
  // Edits and photos waiting for review count toward the admin's badge too (item 4).
  const queuedCount = useModerationStore((s) => s.editQueue.length + s.photoQueue.length);
  const [activeTab, setActiveTab] = useState<ProfileTab>('my-spots');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showLevelInfo, setShowLevelInfo] = useState(false);
  // Remember which src failed (no reset effect needed; a new URL is tried automatically).
  const [failedAvatarSrc, setFailedAvatarSrc] = useState<string | null>(null);

  // iOS swipe-to-close gesture: rightward only

  const userIsAdmin = useIsAdmin();
  const userIsSuperAdmin = useIsSuperAdmin();

  // ALL of the user's spots (approved + pending), newest first: the store already holds them (own or
  // admin spots listener, T30), so no second listener is needed.
  const uid = user?.uid;
  const myAllSpots = useMemo(() => (uid ? spots.filter((spot) => spot.createdBy === uid) : []), [spots, uid]);
  const mine = useMyLevel();

  // Dynamic categories (super admin only), live while the panel is open
  const { categories, addCategory, isAdding } = useCategories(isOpen && userIsSuperAdmin);

  if (!isOpen || !user || !mine) return null;

  const favoriteSpots = spots.filter((spot) => user.savedSpots.includes(spot.id));
  const pendingSpots = spots.filter((spot) => spot.status === 'pending');
  // Item 5: the level comes from XP, computed by the server.
  const { info: levelInfo, xp } = mine;

  return (
    <PanelShell
      onClose={onClose}
      backdropLabel="Close profile panel"
      variant="surface"
      overlays={
        <>
          {/* Settings Panel (nested: stacks inside this root's Z.panel context, see Z.panelInner*) */}
          <SettingsPanel isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
          {showLevelInfo && (
            <LevelInfoModal levelInfo={levelInfo} xp={xp} onClose={() => setShowLevelInfo(false)} />
          )}
        </>
      }
    >
      {/* One scroll for the whole profile (design phase 3): the header scrolls away, and a pull
          down from the top closes the sheet. */}
      <div className="flex-1 overflow-y-auto overscroll-contain" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)' }}>
      <ProfileBanner
        bannerUrl={user.profileBannerURL}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onClose={onClose}
      />

      <ProfileHeader
        user={user}
        levelInfo={levelInfo}
        xp={xp}
        spotsCount={myAllSpots.length}
        favoritesCount={favoriteSpots.length}
        isAdmin={userIsAdmin}
        onOpenLevelInfo={() => setShowLevelInfo(true)}
        failedAvatarSrc={failedAvatarSrc}
        onAvatarFailed={setFailedAvatarSrc}
      />

      <ProfileTabs
        active={activeTab}
        onChange={setActiveTab}
        isAdmin={userIsAdmin}
        isSuperAdmin={userIsSuperAdmin}
        pendingCount={pendingSpots.length + queuedCount}
      />

      <div className="px-4">
        {activeTab === 'my-spots' && <MySpotsTab user={user} spots={myAllSpots} levelInfo={levelInfo} onOpenSpot={onOpenSpot} />}

        {activeTab === 'favorites' && <FavoritesTab spots={favoriteSpots} onOpenSpot={onOpenSpot} />}

        {/* Pending Spots Tab - Admin Only */}
        {activeTab === 'pending' && userIsAdmin && <PendingTab spots={pendingSpots} onOpenSpot={onOpenSpot} />}

        {/* Admin Panel - Super Admin Only */}
        {activeTab === 'admin' && userIsSuperAdmin && (
          <AdminTab categories={categories} addCategory={addCategory} isAdding={isAdding} />
        )}
      </div>
      </div>
    </PanelShell>
  );
}
