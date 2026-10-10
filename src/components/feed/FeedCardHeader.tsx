'use client';

import { useState } from 'react';
import type { Spot } from '@/store/useSpotStore';
import { useT, useLanguage } from '@/hooks/useT';
import { useOpenProfile } from '@/hooks/useOpenProfile';
import { usePublicProfile } from '@/hooks/usePublicProfile';
import { useCategoryLabel } from '@/hooks/useCategory';
import { feedAge, isFreshSpot } from '@/lib/feed';
import { publishedAt } from '@/lib/newSpots';
import { formatLongDate } from '@/lib/dates';
import { getUserNameColor, profileLevel } from '@/lib/levelUtils';
import { resolveNameFontClass } from '@/lib/nameStyle';
import LevelBadge from '../ui/LevelBadge';
import FollowChip from '../profile/FollowChip';
import { useUserStore } from '@/store/useUserStore';

/**
 * Who shared the spot (picture, styled name, level), when, and the category. The picture and the
 * name open the profile; a suggested card offers Follow.
 */
export default function FeedCardHeader({ spot, suggested, now }: Readonly<{ spot: Spot; suggested: boolean; now: number }>) {
  const t = useT();
  const language = useLanguage();
  const openProfile = useOpenProfile();
  const categoryLabel = useCategoryLabel();
  const profile = usePublicProfile(spot.createdBy);
  const own = useUserStore((s) => s.user?.uid === spot.createdBy);
  const [failed, setFailed] = useState(false);

  const name = profile?.username || spot.createdByName || t('anonymous');
  const picture = (profile?.profilePictureURL ?? spot.createdByPhoto) || null;
  const level = profileLevel(profile);
  const at = publishedAt(spot);
  const age = feedAge(at, now);
  const ageText = !age
    ? formatLongDate(spot.approvedAt ?? spot.createdAt, language, '')
    : age.unit === 'now'
      ? t('justNow')
      : t(({ min: 'feedAgeMin', h: 'feedAgeH', d: 'feedAgeD', w: 'feedAgeW' } as const)[age.unit], { n: age.n });

  return (
    <header className="flex items-center gap-3 px-4 h-[60px]">
      <button
        type="button"
        onClick={() => openProfile(spot.createdBy)}
        aria-label={t('openProfileOf', { name })}
        className="no-min-size relative shrink-0 rounded-full touch-manipulation active:scale-90 transition-transform"
      >
        <span className="block w-10 h-10 rounded-full p-[2px] bg-linear-to-tr from-brand-600 via-brand-400 to-amber-300">
          <span className="w-full h-full rounded-full overflow-hidden grid place-items-center bg-brand-700 text-white font-semibold ring-2 ring-surface-0">
            {picture && !failed ? (
              // eslint-disable-next-line @next/next/no-img-element -- user-hosted avatar URLs (any origin)
              <img src={picture} alt="" className="w-full h-full object-cover" onError={() => setFailed(true)} />
            ) : (
              name.charAt(0).toUpperCase()
            )}
          </span>
        </span>
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <button
            type="button"
            onClick={() => openProfile(spot.createdBy)}
            className={`no-min-size min-w-0 truncate text-[15px] font-semibold leading-tight ${resolveNameFontClass(profile?.customNameFont)}`}
            style={{ color: getUserNameColor(level, profile?.customNameColor ?? undefined) }}
          >
            {name}
          </button>
          <LevelBadge level={level} size={16} className="shrink-0" />
          {own && (
            <span className="shrink-0 rounded-full bg-white/10 px-1.5 py-px text-[11px] font-semibold text-label-secondary">
              {t('feedYouShared')}
            </span>
          )}
          {isFreshSpot(spot, now) && (
            <span className="shrink-0 rounded-full bg-brand-500/20 px-1.5 py-px text-[11px] font-bold uppercase tracking-wide text-brand-300">
              {t('feedNew')}
            </span>
          )}
        </div>
        <p className="text-[13px] leading-tight text-label-secondary truncate">
          {ageText}
          {ageText && ' · '}
          {categoryLabel(spot.category)}
        </p>
      </div>
      {suggested && !own && <FollowChip uid={spot.createdBy} isPrivate={profile?.isPrivate === true} tone="text" />}
    </header>
  );
}
