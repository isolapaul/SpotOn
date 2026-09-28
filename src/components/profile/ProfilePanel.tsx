'use client';

import { useMemo, useState } from 'react';
import { useUserStore } from '@/store/useUserStore';
import { useSpotStore } from '@/store/useSpotStore';
import { useSwipeToClose } from '@/hooks/useSwipeToClose';
import { useIsAdmin, useIsSuperAdmin } from '@/hooks/useIsAdmin';
import { useCategories } from '@/hooks/useCategories';
import { getLevelInfo } from '@/lib/levelUtils';
import { SWIPE_THRESHOLDS } from '@/lib/constants';
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
}

export default function ProfilePanel({ isOpen, onClose }: Readonly<ProfilePanelProps>) {
  const user = useUserStore((s) => s.user);
  const spots = useSpotStore((s) => s.spots);
  const [activeTab, setActiveTab] = useState<ProfileTab>('my-spots');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showLevelInfo, setShowLevelInfo] = useState(false);
  // Remember which src failed (no reset effect needed; a new URL is tried automatically).
  const [failedAvatarSrc, setFailedAvatarSrc] = useState<string | null>(null);

  // iOS swipe-to-close gesture: rightward only
  const swipe = useSwipeToClose({ onClose, threshold: SWIPE_THRESHOLDS.panel, direction: 'right' });

  const userIsAdmin = useIsAdmin();
  const userIsSuperAdmin = useIsSuperAdmin();

  // ALL of the user's spots (approved + pending), newest first: the store already holds them (own or
  // admin spots listener, T30), so no second listener is needed.
  const uid = user?.uid;
  const myAllSpots = useMemo(() => (uid ? spots.filter((spot) => spot.createdBy === uid) : []), [spots, uid]);

  // Dynamic categories (super admin only), live while the panel is open
  const { categories, addCategory, isAdding } = useCategories(isOpen && userIsSuperAdmin);

  if (!isOpen || !user) return null;

  const favoriteSpots = spots.filter((spot) => user.savedSpots.includes(spot.id));
  const pendingSpots = spots.filter((spot) => spot.status === 'pending');
  // D8: every own spot (pending too) counts toward the level
  const levelInfo = getLevelInfo(myAllSpots.length);

  return (
    <PanelShell
      onClose={onClose}
      backdropLabel="Close profile panel"
      variant="gray"
      swipe={swipe}
      overlays={
        <>
          {/* Settings Panel (nested: stacks inside this root's Z.panel context, see Z.panelInner*) */}
          <SettingsPanel isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
          {showLevelInfo && (
            <LevelInfoModal levelInfo={levelInfo} spotsCount={myAllSpots.length} onClose={() => setShowLevelInfo(false)} />
          )}
        </>
      }
    >
      <ProfileBanner
        bannerUrl={user.profileBannerURL}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onClose={onClose}
      />

      <ProfileHeader
        user={user}
        levelInfo={levelInfo}
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
        pendingCount={pendingSpots.length}
      />

      {/* Content with Safe Area Bottom Padding */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-6 pt-6" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)' }}>
        {activeTab === 'my-spots' && <MySpotsTab user={user} spots={myAllSpots} levelInfo={levelInfo} />}

        {activeTab === 'favorites' && <FavoritesTab spots={favoriteSpots} />}

        {/* Pending Spots Tab - Admin Only */}
        {activeTab === 'pending' && userIsAdmin && <PendingTab spots={pendingSpots} />}

        {/* Admin Panel - Super Admin Only */}
        {activeTab === 'admin' && userIsSuperAdmin && (
          <AdminTab categories={categories} addCategory={addCategory} isAdding={isAdding} />
        )}
      </div>
    </PanelShell>
  );
}
