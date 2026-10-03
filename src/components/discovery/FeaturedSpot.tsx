'use client';

import Image from 'next/image';
import type { Spot } from '@/store/useSpotStore';
import { useLanguage } from '@/hooks/useT';
import { useCategoryLabel } from '@/hooks/useCategory';
import { formatDistance } from '@/lib/geo';
import { getThumbnailUrl, isImageUnoptimized } from '@/lib/spotImages';
import CategoryIcon from '@/components/ui/CategoryIcon';
import StarRating from '@/components/ui/StarRating';

interface FeaturedSpotProps {
  spot: Spot;
  rating: number;
  reviewCount: number;
  distanceKm: number | null;
  onSelect: () => void;
}

/** The first spot of the Explore list as a big photo card (design phase 3). */
export default function FeaturedSpot({ spot, rating, reviewCount, distanceKm, onSelect }: Readonly<FeaturedSpotProps>) {
  const categoryLabel = useCategoryLabel();
  const language = useLanguage();
  const ratingText = language === 'en' ? rating.toFixed(1) : rating.toFixed(1).replace('.', ',');

  return (
    <button
      type="button"
      onClick={onSelect}
      className="no-min-size relative block w-full aspect-[16/10] rounded-[22px] overflow-hidden text-left bg-surface-2
        shadow-card touch-manipulation active:scale-[.98] transition-transform duration-250 motion-safe:animate-item-in"
    >
      <Image src={getThumbnailUrl(spot)} alt="" fill className="object-cover" sizes="(max-width: 520px) 100vw, 480px" unoptimized={isImageUnoptimized(spot)} />
      <span className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
      <span className="absolute left-4 right-4 bottom-4">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-md px-2.5 py-1 text-[12px] font-semibold text-white">
          <CategoryIcon category={spot.category} className="w-3.5 h-3.5" />
          {categoryLabel(spot.category)}
        </span>
        <span className="mt-2 block text-[24px] font-bold leading-tight text-white line-clamp-2">{spot.name}</span>
        <span className="mt-1 flex items-center gap-1.5 text-[14px] text-white/85">
          {rating > 0 && (
            <>
              <StarRating rating={Math.round(rating)} size="xs" emptyTone="faint" wrapper={false} />
              <span className="tabular-nums">{ratingText} ({reviewCount})</span>
            </>
          )}
          {distanceKm !== null && <span className="tabular-nums">{rating > 0 ? '· ' : ''}{formatDistance(distanceKm, language)}</span>}
        </span>
      </span>
    </button>
  );
}
