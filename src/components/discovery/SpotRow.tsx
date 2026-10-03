'use client';

import Image from 'next/image';
import { ChevronRight } from 'lucide-react';
import type { Spot } from '@/store/useSpotStore';
import { useLanguage, useT } from '@/hooks/useT';
import { useCategoryLabel } from '@/hooks/useCategory';
import { formatDistance } from '@/lib/geo';
import { getThumbnailUrl, isImageUnoptimized } from '@/lib/spotImages';
import CategoryIcon from '@/components/ui/CategoryIcon';
import StarRating from '@/components/ui/StarRating';

interface SpotRowProps {
  spot: Spot;
  rating: number;
  reviewCount: number;
  distanceKm: number | null;
  /** Position in the list: staggers the entrance. */
  index: number;
  onSelect: () => void;
}

/** One row of the Explore list (grouped inset style, design phase 3). */
export default function SpotRow({ spot, rating, reviewCount, distanceKm, index, onSelect }: Readonly<SpotRowProps>) {
  const t = useT();
  const categoryLabel = useCategoryLabel();
  const language = useLanguage();
  const ratingText = language === 'en' ? rating.toFixed(1) : rating.toFixed(1).replace('.', ',');

  return (
    <button
      type="button"
      onClick={onSelect}
      className="no-min-size w-full flex items-center gap-3.5 px-3 py-3 text-left touch-manipulation
        active:bg-white/6 transition-colors motion-safe:animate-item-in"
      style={{ animationDelay: `${Math.min(index, 10) * 35}ms` }}
    >
      <span className="relative w-[68px] h-[68px] shrink-0 rounded-r2 overflow-hidden bg-surface-3">
        <Image src={getThumbnailUrl(spot)} alt="" fill className="object-cover" sizes="68px" unoptimized={isImageUnoptimized(spot)} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[17px] font-semibold leading-snug text-label truncate">{spot.name}</span>
        <span className="mt-0.5 flex items-center gap-1.5 text-[14px] text-label-secondary min-w-0">
          <CategoryIcon category={spot.category} className="w-4 h-4 shrink-0 text-brand-400" />
          <span className="truncate">
            {categoryLabel(spot.category)}
            {distanceKm !== null && <span className="tabular-nums"> · {formatDistance(distanceKm, language)}</span>}
          </span>
        </span>
        <span className="mt-1 flex items-center gap-1 text-[13px]">
          {rating > 0 ? (
            <>
              <StarRating rating={Math.round(rating)} size="xs" emptyTone="faint" wrapper={false} />
              <span className="ml-1 text-label tabular-nums">{ratingText}</span>
              <span className="text-label-tertiary tabular-nums">({reviewCount})</span>
            </>
          ) : (
            <span className="text-label-tertiary">{t('noRating')}</span>
          )}
        </span>
      </span>
      <ChevronRight className="w-5 h-5 shrink-0 text-label-tertiary" aria-hidden="true" />
    </button>
  );
}
