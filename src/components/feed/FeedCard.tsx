'use client';

import { useMemo, useState } from 'react';
import { Heart, MessageCircle, Share, ThumbsUp } from 'lucide-react';
import type { Spot } from '@/store/useSpotStore';
import { useT, useLanguage } from '@/hooks/useT';
import { useFavoriteToggle } from '@/hooks/useFavoriteToggle';
import { useShareSpot } from '@/hooks/useShareSpot';
import { usePhotoLike } from '@/hooks/usePhotoLike';
import { useUiStore } from '@/store/useUiStore';
import { playSound } from '@/store/useSoundStore';
import { averageRating } from '@/lib/rating';
import { feedPhotos } from '@/lib/feed';
import { formatDistance, haversineKm } from '@/lib/geo';
import StarRating from '../ui/StarRating';
import FeedMedia from './FeedMedia';
import FeedCardHeader from './FeedCardHeader';

interface FeedCardProps {
  spot: Spot;
  /** Position in the rendered list, for the staggered entrance. */
  index: number;
  /** A suggested card (someone not followed yet): the header offers Follow. */
  suggested: boolean;
  now: number;
  userLocation: { lat: number; lng: number } | null;
  onShowOnMap: (spotId: string) => void;
  onComments: (spotId: string) => void;
}

const ACTION = `no-min-size h-11 min-w-11 px-2 inline-flex items-center gap-1.5 rounded-full text-label touch-manipulation
  active:scale-90 transition-transform duration-150`;

/**
 * One post of the following feed: who shared it, the photos, the like / comment / share /
 * favourite row, the name, description and rating. The name and the map pill fly to the spot.
 */
export default function FeedCard({ spot, index, suggested, now, userLocation, onShowOnMap, onComments }: Readonly<FeedCardProps>) {
  const t = useT();
  const language = useLanguage();
  const photos = useMemo(() => feedPhotos(spot), [spot]);
  const [photoIndex, setPhotoIndex] = useState(0);
  const like = usePhotoLike(spot.id, photos[photoIndex]);
  const favorite = useFavoriteToggle(spot.id);
  const share = useShareSpot();
  const [expanded, setExpanded] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const reviews = spot.reviews?.length ?? 0;
  const avg = averageRating(spot.reviews);
  const avgText = language === 'en' ? avg.toFixed(1) : avg.toFixed(1).replace('.', ',');
  const distance = userLocation
    ? formatDistance(haversineKm(userLocation.lat, userLocation.lng, spot.location.lat, spot.location.lng), language)
    : null;

  // The card dips, then the feed slides away while the map flies to the spot.
  const showOnMap = () => {
    if (leaving) return;
    setLeaving(true);
    setTimeout(() => onShowOnMap(spot.id), 120);
  };
  const toggleFavorite = () => {
    if (!favorite.canToggle) return useUiStore.getState().openPanel('auth');
    if (!favorite.isFavorite) playSound('favorite');
    void favorite.toggle();
  };

  return (
    <article
      aria-label={spot.name}
      className={`pb-5 transition-transform duration-150 ease-ios ${leaving ? 'scale-[.97]' : ''} ${
        index < 6 ? 'motion-safe:animate-item-in' : ''
      }`}
      style={{ animationDelay: `${Math.min(index, 6) * 40}ms` }}
    >
      <FeedCardHeader spot={spot} suggested={suggested} now={now} />

      <FeedMedia
        spot={spot}
        photos={photos}
        index={photoIndex}
        onIndex={setPhotoIndex}
        onDoubleTap={() => void like.like()}
        onShowOnMap={showOnMap}
      />

      {/* Actions */}
      <div className="flex items-center gap-1 px-2 pt-1.5">
        {like.canLike && (
          <button type="button" onClick={() => void like.toggle()} aria-pressed={like.liked} aria-label={t('likePhoto')} className={ACTION}>
            <ThumbsUp
              key={String(like.liked)}
              className={`w-[24px] h-[24px] ${like.liked ? 'fill-brand-500 text-brand-400 motion-safe:animate-badge-pop' : ''}`}
              strokeWidth={2}
              aria-hidden="true"
            />
            {like.likes > 0 && (
              <span key={like.likes} className="text-[15px] font-semibold tabular-nums motion-safe:animate-rise-in">{like.likes}</span>
            )}
          </button>
        )}
        <button type="button" onClick={() => onComments(spot.id)} aria-label={t('reviews')} className={ACTION}>
          <MessageCircle className="w-[24px] h-[24px]" strokeWidth={2} aria-hidden="true" />
          {reviews > 0 && <span className="text-[15px] font-semibold tabular-nums">{reviews}</span>}
        </button>
        <button type="button" onClick={() => void share(spot)} aria-label={t('share')} className={ACTION}>
          <Share className="w-[22px] h-[22px]" strokeWidth={2} aria-hidden="true" />
        </button>
        <span className="flex-1" />
        <button
          type="button"
          onClick={toggleFavorite}
          aria-pressed={favorite.isFavorite}
          aria-label={favorite.isFavorite ? t('removeFromFavorites') : t('addToFavorites')}
          className={`${ACTION} relative`}
        >
          {favorite.isFavorite && (
            <span key="ring" aria-hidden="true" className="absolute inset-1.5 rounded-full border-2 border-[#FF375F]/60 motion-safe:animate-ring-ping opacity-0" />
          )}
          <Heart
            key={String(favorite.isFavorite)}
            className={`w-[24px] h-[24px] ${favorite.isFavorite ? 'fill-[#FF375F] text-[#FF375F] motion-safe:animate-badge-pop' : ''}`}
            strokeWidth={2}
            aria-hidden="true"
          />
        </button>
      </div>

      {/* Caption */}
      <div className="px-4">
        <button type="button" onClick={showOnMap} className="no-min-size block text-left touch-manipulation active:opacity-70">
          <h3 className="text-[17px] font-semibold leading-snug text-label">{spot.name}</h3>
        </button>
        {spot.description && (
          <p className={`mt-0.5 text-[15px] leading-snug text-label-secondary whitespace-pre-line wrap-break-word ${expanded ? '' : 'line-clamp-2'}`}>
            {spot.description}
          </p>
        )}
        {spot.description && !expanded && spot.description.length > 90 && (
          <button type="button" onClick={() => setExpanded(true)} className="no-min-size text-[14px] font-medium text-label-tertiary">
            {t('feedMore')}
          </button>
        )}
        <div className="mt-1.5 flex items-center gap-1 text-[14px] min-w-0">
          {reviews > 0 ? (
            <button type="button" onClick={() => onComments(spot.id)} className="no-min-size inline-flex items-center gap-1 min-w-0">
              <StarRating rating={Math.round(avg)} size="sm" emptyTone="dim" wrapper={false} />
              <span className="ml-1 text-label tabular-nums">{avgText}</span>
              <span className="text-label-tertiary tabular-nums">({reviews})</span>
            </button>
          ) : (
            <button type="button" onClick={() => onComments(spot.id)} className="no-min-size text-brand-400 font-medium truncate">
              {t('feedFirstReview')}
            </button>
          )}
          {distance && <span className="text-label-tertiary tabular-nums shrink-0">· {distance}</span>}
        </div>
      </div>
    </article>
  );
}
