'use client';

import { useState } from 'react';
import Image from 'next/image';
import { CheckCircle2, Heart, Navigation, X } from 'lucide-react';
import type { Spot } from '@/store/useSpotStore';
import { useSpotStore } from '@/store/useSpotStore';
import { useToastStore } from '@/store/useToastStore';
import { useLanguage, useT } from '@/hooks/useT';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useFavoriteToggle } from '@/hooks/useFavoriteToggle';
import { categoryTranslationKeys, getNavigationUrl } from '@/lib/spotUtils';
import { averageRating } from '@/lib/rating';
import { formatDistance, haversineKm } from '@/lib/geo';
import { getPreviewImageUrl, imageFallbacks, isImageUnoptimized, PLACEHOLDER_URL, sortSpotImagesByLikes } from '@/lib/spotImages';
import CategoryIcon from '@/components/ui/CategoryIcon';
import StarRating from '@/components/ui/StarRating';

interface PlaceCardContentProps {
  spot: Spot;
  /** The user's real location (not the default map centre); null hides the distance. */
  userLocation: { lat: number; lng: number } | null;
  onClose: () => void;
  onDetails: () => void;
  /** The photo is the source of the details morph (off while the card leaves: names must be unique). */
  morphSource: boolean;
}

function Thumb({ spot, morphSource }: Readonly<{ spot: Spot; morphSource: boolean }>) {
  const vt = morphSource ? { 'data-vt-thumb': '' } : {};
  // Most-liked image first ('bothRequired' tie-break, as the former info window); when it does not
  // load, the spot's other images and its legacy imageUrl.
  const sorted = sortSpotImagesByLikes(spot.spotImages || [], 'bothRequired');
  const [failed, setFailed] = useState<readonly string[]>([]);
  const url = [getPreviewImageUrl(spot, sorted), ...imageFallbacks(spot, sorted)].find(
    (u) => u !== PLACEHOLDER_URL && !failed.includes(u),
  );
  if (!url) {
    return (
      <span {...vt} className="w-[88px] h-[88px] flex-shrink-0 rounded-[18px] grid place-items-center bg-brand-500/15 text-brand-400">
        <CategoryIcon category={spot.category} className="w-9 h-9" />
      </span>
    );
  }
  return (
    <span {...vt} className="relative w-[88px] h-[88px] flex-shrink-0 rounded-[18px] overflow-hidden bg-surface-3">
      <Image key={url} src={url} alt="" fill sizes="88px" className="object-cover" unoptimized={isImageUnoptimized(spot)} onError={() => setFailed((f) => [...f, url])} />
    </span>
  );
}

/** The place card's body (design 1E): keyed by spot, so switching pins resets its state. */
export default function PlaceCardContent({ spot, userLocation, onClose, onDetails, morphSource }: Readonly<PlaceCardContentProps>) {
  const t = useT();
  const language = useLanguage();
  const isAdmin = useIsAdmin();
  const approveSpot = useSpotStore((s) => s.approveSpot);
  const showToast = useToastStore((s) => s.showToast);
  const { isFavorite, toggle, canToggle } = useFavoriteToggle(spot.id);
  const [approving, setApproving] = useState(false);

  const reviewCount = spot.reviews?.length || 0;
  const avg = averageRating(spot.reviews);
  const avgText = language === 'en' ? avg.toFixed(1) : avg.toFixed(1).replace('.', ',');
  const distance = userLocation
    ? formatDistance(haversineKm(userLocation.lat, userLocation.lng, spot.location.lat, spot.location.lng), language)
    : null;
  const pending = spot.status !== 'approved';

  const approve = async () => {
    setApproving(true);
    try {
      await approveSpot(spot.id);
      showToast(t('spotApproved'), 'success');
      onClose();
    } catch (error) {
      console.error('Failed to approve spot:', error);
      showToast(t('approveError'), 'error');
    } finally {
      setApproving(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="flex gap-3.5">
        <button type="button" onClick={onDetails} tabIndex={-1} aria-hidden="true" className="no-min-size block flex-shrink-0 touch-manipulation active:opacity-80">
          <Thumb spot={spot} morphSource={morphSource} />
        </button>
        <div className="min-w-0 flex-1 pt-0.5">
          <button type="button" onClick={onDetails} tabIndex={-1} className="no-min-size block text-left touch-manipulation">
            <h2 className="text-[17px] font-semibold leading-snug text-label line-clamp-2">{spot.name}</h2>
          </button>
          <p className="mt-0.5 flex items-center gap-1.5 text-[15px] text-label-secondary min-w-0 motion-safe:animate-rise-in" style={{ animationDelay: '60ms' }}>
            <CategoryIcon category={spot.category} className="w-4 h-4 flex-shrink-0 text-brand-400" />
            <span className="truncate">
              {t(categoryTranslationKeys[spot.category])}
              {distance && <span className="tabular-nums"> · {distance}</span>}
            </span>
          </p>
          <div className="mt-1 flex items-center gap-1 text-[15px] motion-safe:animate-rise-in" style={{ animationDelay: '110ms' }}>
            {reviewCount > 0 ? (
              <>
                <StarRating rating={Math.round(avg)} size="sm" emptyTone="dim" wrapper={false} />
                <span className="ml-1 text-label tabular-nums">{avgText}</span>
                <span className="text-label-tertiary tabular-nums">({reviewCount})</span>
              </>
            ) : (
              <span className="min-w-0 text-label-tertiary truncate">{t('noReviews')}</span>
            )}
          </div>
          {pending && (
            <span className="mt-1.5 inline-block rounded-full px-2 py-0.5 text-[12px] font-semibold bg-warn-500/15 text-warn-500">
              {t('pending')}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('close')}
          className="-mr-1.5 -mt-1 w-11 h-11 flex-shrink-0 grid place-items-center rounded-full touch-manipulation"
        >
          <span className="w-[30px] h-[30px] rounded-full grid place-items-center bg-white/10">
            <X className="w-4 h-4 text-label-secondary" strokeWidth={2.5} />
          </span>
        </button>
      </div>

      {isAdmin && pending && (
        <button
          type="button"
          onClick={approve}
          disabled={approving}
          className="mt-3 w-full h-11 rounded-xl flex items-center justify-center gap-2 bg-brand-500/15 text-brand-300
            font-semibold text-[15px] touch-manipulation active:scale-[.98] transition-transform disabled:opacity-50"
        >
          <CheckCircle2 className="w-[18px] h-[18px]" />
          {approving ? t('approving') : t('approve')}
        </button>
      )}

      <div className="mt-3 flex gap-2 motion-safe:animate-rise-in" style={{ animationDelay: '160ms' }}>
        <a
          href={getNavigationUrl(spot.location.lat, spot.location.lng)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 h-[50px] rounded-full flex items-center justify-center gap-2 bg-brand-600 text-white
            font-semibold text-[16px] touch-manipulation active:scale-[.97] transition-transform"
        >
          <Navigation className="w-[18px] h-[18px]" strokeWidth={2.2} />
          {t('directions')}
        </a>
        <button
          type="button"
          onClick={onDetails}
          aria-label={t('viewDetails')}
          className="flex-1 h-[50px] rounded-full bg-white/10 text-label font-semibold text-[16px]
            touch-manipulation active:scale-[.97] transition-transform"
        >
          {t('details')}
        </button>
        {canToggle && (
          <button
            type="button"
            onClick={toggle}
            aria-label={isFavorite ? t('removeFromFavorites') : t('addToFavorites')}
            aria-pressed={isFavorite}
            className="w-[58px] h-[50px] flex-shrink-0 rounded-full grid place-items-center bg-white/10
              touch-manipulation active:scale-90 transition-transform"
          >
            <Heart
              key={String(isFavorite)}
              className={`w-5 h-5 ${isFavorite ? 'fill-[#FF375F] text-[#FF375F] motion-safe:animate-badge-pop' : 'text-label'}`}
              strokeWidth={2}
            />
          </button>
        )}
      </div>
    </div>
  );
}
