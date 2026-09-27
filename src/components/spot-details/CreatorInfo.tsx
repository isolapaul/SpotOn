'use client';

import { Calendar, User } from 'lucide-react';
import type { Spot } from '@/store/useSpotStore';
import { useLanguage, useT } from '@/hooks/useT';
import { usePublicProfile } from '@/hooks/usePublicProfile';
import { getLevelInfo, getUserNameColor } from '@/lib/levelUtils';
import { formatLongDate } from '@/lib/dates';

interface CreatorInfoProps {
  spot: Spot;
}

/** Meta grid: the date the spot was added and its creator (name colour and level from the public profile). */
export default function CreatorInfo({ spot }: Readonly<CreatorInfoProps>) {
  const t = useT();
  // Date locale: English while no language is chosen yet (unchanged pre-T24 behaviour).
  const language = useLanguage({ fallback: 'en' });
  const creatorProfile = usePublicProfile(spot.createdBy);

  const creatorSpotsCount = creatorProfile?.spotsCount ?? 0;
  const creatorDisplayName = creatorProfile?.username || spot.createdByName || t('anonymous');
  const creatorNameColor = getUserNameColor(creatorSpotsCount, creatorProfile?.customNameColor ?? undefined);
  const creatorLevelInfo = getLevelInfo(creatorSpotsCount);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="glass-card p-4">
        <div className="flex items-center gap-2 text-white/60 mb-1">
          <Calendar className="w-4 h-4" />
          <span className="text-xs uppercase">{t('addedOn')}</span>
        </div>
        <p className="text-white font-medium">{formatLongDate(spot.createdAt, language, t('unknownDate'))}</p>
      </div>
      <div className="glass-card p-4">
        <div className="flex items-center gap-2 text-white/60 mb-1">
          <User className="w-4 h-4" />
          <span className="text-xs uppercase">{t('by')}</span>
        </div>
        <div className="flex items-center gap-2">
          <p className="font-medium" style={{ color: creatorNameColor }}>{creatorDisplayName}</p>
          <span className={`text-xs px-2 py-0.5 rounded-full border ${creatorLevelInfo.bgColor} ${creatorLevelInfo.borderColor} ${creatorLevelInfo.textColor}`}>
            {creatorLevelInfo.icon} {creatorLevelInfo.level}
          </span>
        </div>
      </div>
    </div>
  );
}
