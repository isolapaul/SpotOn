'use client';

import type { User } from '@/store/useUserStore';
import type { LevelInfo } from '@/lib/levelUtils';
import ProfileAvatar from './ProfileAvatar';
import UsernameEditor from './UsernameEditor';
import ProfileBadges from './ProfileBadges';
import LevelProgressCard from './LevelProgressCard';
import ProfileStats from './ProfileStats';
import BioEditor from './BioEditor';
import { useMyLevelStore } from '@/store/useMyLevelStore';

interface ProfileHeaderProps {
  user: User;
  levelInfo: LevelInfo;
  xp: number;
  spotsCount: number;
  isAdmin: boolean;
  onOpenLevelInfo: () => void;
  failedAvatarSrc: string | null;
  onAvatarFailed: (src: string | null) => void;
}

/** Avatar & user info column, overlapping the banner. */
export default function ProfileHeader({
  user,
  levelInfo,
  xp,
  spotsCount,
  isAdmin,
  onOpenLevelInfo,
  failedAvatarSrc,
  onAvatarFailed,
}: Readonly<ProfileHeaderProps>) {
  const followers = useMyLevelStore((s) => s.followers);
  const following = useMyLevelStore((s) => s.following);
  return (
    <div className="shrink-0 px-5 -mt-14 mb-5 relative">
      <div className="flex flex-col items-center">
        {/* Large Profile Picture */}
        <ProfileAvatar user={user} failedSrc={failedAvatarSrc} onFailed={onAvatarFailed} />

        {/* User Info - Centered */}
        <div className="flex flex-col items-center mt-4 w-full">
          <div className="flex items-center gap-2 mb-2 flex-wrap justify-center">
            <UsernameEditor username={user.username} />
          </div>

          <ProfileBadges isAdmin={isAdmin} />

          <BioEditor bio={user.bio} />

          {/* Who you are and your numbers first, then the level card, then the tabs. */}
          <ProfileStats spots={spotsCount} followers={followers} following={following} className="mt-1 mb-5" />

          <LevelProgressCard levelInfo={levelInfo} xp={xp} onOpen={onOpenLevelInfo} />
        </div>
      </div>
    </div>
  );
}
