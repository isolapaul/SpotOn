'use client';

import { Shield } from 'lucide-react';
import InviteBadge from '../ui/InviteBadge';
import { BADGE_NAME } from '../invite/InviteSheet';
import { inviteBadge } from '@/lib/referral';
import { useT } from '@/hooks/useT';

interface ProfileBadgesProps {
  isAdmin: boolean;
  /** People who joined with this user's invite: the Ambassador badge from 3 (growth plan §2). */
  invites?: number;
}

/** The admin shield and the invite badge under the name (the level is shown by the level card). */
export default function ProfileBadges({ isAdmin, invites = 0 }: Readonly<ProfileBadgesProps>) {
  const t = useT();
  const tier = inviteBadge(invites);
  if (!isAdmin && !tier) return null;
  return (
    <div className="flex items-center gap-2 mb-3 flex-wrap justify-center">
      {isAdmin && (
        <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/20 border border-amber-500/30">
          <Shield className="w-4 h-4 text-amber-400" />
        </div>
      )}
      {tier && (
        <div className="flex items-center gap-1.5 pl-1 pr-2.5 py-0.5 rounded-full bg-white/8">
          <InviteBadge tier={tier} size={24} />
          <span className="text-[12px] font-semibold text-label">{t(BADGE_NAME[tier])}</span>
        </div>
      )}
    </div>
  );
}
