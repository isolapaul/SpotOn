'use client';

import LevelBadge from '@/components/ui/LevelBadge';
import { Calendar, User } from 'lucide-react';
import type { Spot } from '@/store/useSpotStore';
import { useLanguage, useT } from '@/hooks/useT';
import { usePublicProfile } from '@/hooks/usePublicProfile';
import { getLevelInfo, getUserNameColor, profileLevel } from '@/lib/levelUtils';
import { formatLongDate } from '@/lib/dates';

interface CreatorInfoProps {
  spot: Spot;
}

/** Info card rows (design phase 3): when the spot was added and its creator (name colour and level from the public profile). */
export default function CreatorInfo({ spot }: Readonly<CreatorInfoProps>) {
  const t = useT();
  // Date locale: English while no language is chosen yet (unchanged pre-T24 behaviour).
  const language = useLanguage({ fallback: 'en' });
  const creatorProfile = usePublicProfile(spot.createdBy);

  const creatorLevel = profileLevel(creatorProfile);
  const creatorDisplayName = creatorProfile?.username || spot.createdByName || t('anonymous');
  const creatorNameColor = getUserNameColor(creatorLevel, creatorProfile?.customNameColor ?? undefined);
  const creatorLevelInfo = getLevelInfo(creatorLevel);

  return (
    <>
      <div className="flex items-center gap-3.5 px-4 py-3">
        <Calendar className="w-5 h-5 text-label-secondary flex-shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] text-label-secondary">{t('addedOn')}</span>
          <span className="block text-[15px] text-label">{formatLongDate(spot.createdAt, language, t('unknownDate'))}</span>
        </span>
      </div>
      <div className="flex items-center gap-3.5 px-4 py-3">
        <User className="w-5 h-5 text-label-secondary flex-shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] text-label-secondary">{t('by')}</span>
          <span className="flex items-center gap-2">
            <span className="text-[15px] font-semibold truncate" style={{ color: creatorNameColor }}>{creatorDisplayName}</span>
            <span className={`inline-flex items-center gap-1 text-xs pl-0.5 pr-2 py-0.5 rounded-full ${creatorLevelInfo.bgColor} ${creatorLevelInfo.textColor} font-semibold`}>
              <LevelBadge level={creatorLevelInfo.level} size={16} />
              {creatorLevelInfo.level}
            </span>
          </span>
        </span>
      </div>
    </>
  );
}
