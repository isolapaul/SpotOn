'use client';

import type { User } from '@/store/useUserStore';
import type { LevelInfo } from '@/lib/levelUtils';
import ProfileAvatar from './ProfileAvatar';
import UsernameEditor from './UsernameEditor';
import ProfileBadges from './ProfileBadges';
import LevelProgressCard from './LevelProgressCard';
import ProfileStats from './ProfileStats';

interface ProfileHeaderProps {
  user: User;
  levelInfo: LevelInfo;
  spotsCount: number;
  favoritesCount: number;
  isAdmin: boolean;
  onOpenLevelInfo: () => void;
  failedAvatarSrc: string | null;
  onAvatarFailed: (src: string | null) => void;
}

/** Avatar & user info column, overlapping the banner. */
export default function ProfileHeader({
  user,
  levelInfo,
  spotsCount,
  favoritesCount,
  isAdmin,
  onOpenLevelInfo,
  failedAvatarSrc,
  onAvatarFailed,
}: Readonly<ProfileHeaderProps>) {
  return (
    <div className="flex-shrink-0 px-5 -mt-14 mb-5 relative">
      <div className="flex flex-col items-center">
        {/* Large Profile Picture */}
        <ProfileAvatar user={user} failedSrc={failedAvatarSrc} onFailed={onAvatarFailed} />

        {/* User Info - Centered */}
        <div className="flex flex-col items-center mt-4 w-full">
          <div className="flex items-center gap-2 mb-2 flex-wrap justify-center">
            <UsernameEditor username={user.username} />
          </div>

          <ProfileBadges isAdmin={isAdmin} levelInfo={levelInfo} onOpenLevelInfo={onOpenLevelInfo} />

          <LevelProgressCard levelInfo={levelInfo} spotsCount={spotsCount} />

          <ProfileStats spotsCount={spotsCount} favoritesCount={favoritesCount} />
        </div>
      </div>
    </div>
  );
}
