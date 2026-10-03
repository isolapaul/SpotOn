'use client';

import LevelBadge from '@/components/ui/LevelBadge';
import { Shield } from 'lucide-react';
import type { Review } from '@/store/useSpotStore';
import type { PublicProfileResult } from '@/hooks/usePublicProfile';
import { getLevelInfo, getUserNameColor, profileLevel } from '@/lib/levelUtils';
import { resolveNameFontClass } from '@/lib/nameStyle';

interface ReviewerBadgeProps {
  profile: PublicProfileResult;
  review: Review;
}

// Display style comes only from the reviewer's public profile; the review's own legacy
// style/level fields are spoofable and never read (SEC-05).
// `profile` is undefined while loading and null without a profile document.
export default function ReviewerBadge({ profile, review }: Readonly<ReviewerBadgeProps>) {
  const level = profileLevel(profile);
  const levelInfo = getLevelInfo(level);
  const nameColor = getUserNameColor(level, profile?.customNameColor ?? undefined);
  const fontClass = resolveNameFontClass(profile?.customNameFont);
  return (
    <div className="flex items-center gap-2">
      <p
        className={`font-medium ${fontClass}`}
        style={{ color: nameColor }}
      >
        {profile?.username || review.userName}
      </p>
      <span className={`inline-flex items-center gap-1 text-xs pl-0.5 pr-2 py-0.5 rounded-full border ${levelInfo.bgColor} ${levelInfo.borderColor} ${levelInfo.textColor} font-semibold`}>
            <LevelBadge level={levelInfo.level} size={16} />
            {levelInfo.level}
          </span>
      {profile?.isAdmin === true && (
        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30">
          <Shield className="w-3 h-3 text-amber-400" />
          <span className="text-amber-400 text-xs font-bold">Admin</span>
        </div>
      )}
    </div>
  );
}
