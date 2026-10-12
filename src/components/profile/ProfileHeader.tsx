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
import { useState } from 'react';
import FollowListSheet from './FollowListSheet';
import InviteSheet from '../invite/InviteSheet';
import ChallengeCard from '../challenge/ChallengeCard';
import { Footprints, Gift } from 'lucide-react';
import VisitsSheet from './VisitsSheet';
import { useVisitStore } from '@/store/useVisitStore';
import { useT } from '@/hooks/useT';
import type { FollowListKind } from '@/store/useFollowStore';

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
  const invites = useMyLevelStore((s) => s.invites);
  const badges = useMyLevelStore((s) => s.badges);
  const [inviting, setInviting] = useState(false);
  const [stamps, setStamps] = useState(false);
  const visitCount = useVisitStore((s) => s.visits.length);
  const t = useT();
  const [followList, setFollowList] = useState<FollowListKind | null>(null);
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

          <ProfileBadges isAdmin={isAdmin} invites={invites} badges={badges} />

          <BioEditor bio={user.bio} />

          {/* Who you are and your numbers first, then the level card, then the tabs. */}
          <ProfileStats spots={spotsCount} followers={followers} following={following} className="mt-1 mb-5" onOpenList={setFollowList} />
          {followList && <FollowListSheet uid={user.uid} initial={followList} onClose={() => setFollowList(null)} />}

          <LevelProgressCard levelInfo={levelInfo} xp={xp} onOpen={onOpenLevelInfo} />

          {/* Growth plan §4 and §2: the "I was here" stamps and the personal invite link */}
          <div className="mt-3 w-full grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setStamps(true)}
              className="h-12 rounded-2xl bg-white/6 text-label font-semibold flex items-center justify-center gap-2"
            >
              <Footprints className="w-4 h-4 text-brand-300" aria-hidden="true" />
              {t('visitsButton', { count: visitCount })}
            </button>
            <button
              type="button"
              onClick={() => setInviting(true)}
              className="h-12 rounded-2xl bg-brand-600/15 ring-1 ring-brand-400/30 text-brand-200 font-semibold flex items-center justify-center gap-2"
            >
              <Gift className="w-4 h-4" aria-hidden="true" />
              {t('inviteFriends')}
            </button>
          </div>
          <div className="mt-3 w-full empty:hidden"><ChallengeCard /></div>
          {inviting && <InviteSheet onClose={() => setInviting(false)} />}
          {stamps && <VisitsSheet onClose={() => setStamps(false)} />}
        </div>
      </div>
    </div>
  );
}
