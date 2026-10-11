'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Gift, Lock, Plus, X } from 'lucide-react';
import type { Spot } from '@/store/useSpotStore';
import { useUserStore } from '@/store/useUserStore';
import { useUiStore } from '@/store/useUiStore';
import { useLanguage, useT } from '@/hooks/useT';
import { useCategoryLabel } from '@/hooks/useCategory';
import { formatDistance, haversineKm } from '@/lib/geo';
import { getPreviewImageUrl, isImageUnoptimized, PLACEHOLDER_URL, sortSpotImagesByLikes } from '@/lib/spotImages';
import { nativePlatform } from '@/lib/nativeApp';
import CategoryIcon from '@/components/ui/CategoryIcon';
import InviteSheet from '../invite/InviteSheet';

interface LockedPlaceCardProps {
  spot: Spot;
  userLocation: { lat: number; lng: number } | null;
  onClose: () => void;
  onAddSpot: () => void;
}

/**
 * A locked place's card (growth plan §5): the photo blurred, the category and the distance, and
 * what unlocks every place (a first spot; outside the iOS app also a friend who joins).
 */
export default function LockedPlaceCard({ spot, userLocation, onClose, onAddSpot }: Readonly<LockedPlaceCardProps>) {
  const t = useT();
  const language = useLanguage();
  const categoryLabel = useCategoryLabel();
  const signedIn = useUserStore((s) => !!s.user);
  const [inviting, setInviting] = useState(false);
  const ios = nativePlatform() === 'ios';
  const url = getPreviewImageUrl(spot, sortSpotImagesByLikes(spot.spotImages || [], 'bothRequired'));
  const distance = userLocation
    ? formatDistance(haversineKm(userLocation.lat, userLocation.lng, spot.location.lat, spot.location.lng), language)
    : null;
  const invite = () => {
    if (signedIn) setInviting(true);
    else useUiStore.getState().openPanel('auth');
  };

  return (
    <div className="animate-fade-in">
      <div className="flex gap-3.5">
        <span className="relative w-[88px] h-[88px] shrink-0 rounded-[18px] overflow-hidden bg-surface-3">
          {url && url !== PLACEHOLDER_URL ? (
            <Image src={url} alt="" fill sizes="88px" className="object-cover blur-md scale-125 opacity-80" unoptimized={isImageUnoptimized(spot)} />
          ) : (
            <span className="absolute inset-0 grid place-items-center bg-brand-500/15 text-brand-400">
              <CategoryIcon category={spot.category} className="w-9 h-9 blur-[2px]" />
            </span>
          )}
          <span className="absolute inset-0 grid place-items-center bg-black/25">
            <Lock className="w-6 h-6 text-white drop-shadow motion-safe:animate-level-pop" aria-hidden="true" />
          </span>
        </span>
        <div className="min-w-0 flex-1 pt-0.5">
          <h2 className="text-[17px] font-semibold leading-snug text-label">{t('lockedTitle')}</h2>
          <p className="mt-0.5 flex items-center gap-1.5 text-[15px] text-label-secondary min-w-0">
            <CategoryIcon category={spot.category} className="w-4 h-4 shrink-0 text-brand-400" />
            <span className="truncate">
              {categoryLabel(spot.category)}
              {distance && <span className="tabular-nums"> · {distance}</span>}
            </span>
          </p>
          <p className="mt-1 text-[13px] text-label-tertiary">{t(ios ? 'lockedTextIos' : 'lockedText')}</p>
        </div>
        <button type="button" onClick={onClose} aria-label={t('close')} className="-mr-1.5 -mt-1 w-11 h-11 shrink-0 grid place-items-center rounded-full touch-manipulation">
          <span className="w-[30px] h-[30px] rounded-full grid place-items-center bg-white/10">
            <X className="w-4 h-4 text-label-secondary" strokeWidth={2.5} />
          </span>
        </button>
      </div>
      <div className={`mt-4 grid gap-2 ${ios ? 'grid-cols-1' : 'grid-cols-2'}`}>
        <button type="button" onClick={onAddSpot} className="h-[50px] rounded-full bg-brand-600 text-white font-semibold flex items-center justify-center gap-2">
          <Plus className="w-5 h-5" aria-hidden="true" />
          {t('lockedAddSpot')}
        </button>
        {!ios && (
          <button type="button" onClick={invite} className="h-[50px] rounded-full bg-white/10 text-label font-semibold flex items-center justify-center gap-2">
            <Gift className="w-5 h-5" aria-hidden="true" />
            {t('lockedInvite')}
          </button>
        )}
      </div>
      {inviting && <InviteSheet onClose={() => setInviting(false)} />}
    </div>
  );
}
