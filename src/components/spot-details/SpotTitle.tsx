'use client';

import { Pencil, Star } from 'lucide-react';
import type { Spot } from '@/store/useSpotStore';
import { useLanguage, useT } from '@/hooks/useT';
import { useCategoryLabel } from '@/hooks/useCategory';
import CategoryIcon from '@/components/ui/CategoryIcon';
import StarRating from '../ui/StarRating';
import type { SpotEdit } from './useSpotEdit';

interface SpotTitleProps {
  spot: Spot;
  avgRating: number;
  canEdit: boolean;
  edit: SpotEdit;
  isHighlightedByUser: boolean;
}

/**
 * Title (or the name input while editing), highlight star and edit button, then one quiet line with
 * the category and the rating, as the place card shows them.
 */
export default function SpotTitle({ spot, avgRating, canEdit, edit, isHighlightedByUser }: Readonly<SpotTitleProps>) {
  const t = useT();
  const categoryLabel = useCategoryLabel();
  const language = useLanguage();
  const reviewCount = spot.reviews?.length || 0;
  const ratingText = language === 'en' ? avgRating.toFixed(1) : avgRating.toFixed(1).replace('.', ',');
  return (
    <div>
      <div className="flex items-start gap-2">
        {edit.isEditing ? (
          <input
            type="text"
            value={edit.editName}
            onChange={(e) => edit.setEditName(e.target.value)}
            maxLength={100}
            className="text-2xl font-bold text-white bg-white/10 border border-white/20 rounded-xl px-3 py-2 focus:outline-hidden focus:ring-2 focus:ring-primary-500 flex-1 min-w-0 w-full"
          />
        ) : (
          <h1 className="flex-1 min-w-0 text-[28px] leading-[1.15] font-bold text-label wrap-break-word">
            {spot.name}
            {isHighlightedByUser && (
              <Star
                className="inline-block align-[-0.1em] ml-2 w-6 h-6 text-gold fill-gold motion-safe:animate-badge-pop"
                aria-label={t('spotHasHighlight')}
                role="img"
              />
            )}
          </h1>
        )}
        {canEdit && !edit.isEditing && (
          <button
            type="button"
            onClick={edit.start}
            className="no-min-size -mr-1.5 -mt-1 w-11 h-11 shrink-0 grid place-items-center rounded-full touch-manipulation"
            aria-label={t('editSpot')}
          >
            <span className="w-9 h-9 grid place-items-center rounded-full bg-white/10 active:bg-white/20 transition-colors">
              <Pencil className="w-4 h-4 text-white/70" aria-hidden="true" />
            </span>
          </button>
        )}
      </div>
      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px] text-label-secondary">
        <span className="inline-flex items-center gap-1.5">
          <CategoryIcon category={spot.category} className="w-4 h-4 shrink-0 text-brand-400" />
          {categoryLabel(spot.category)}
        </span>
        <span aria-hidden="true" className="-mx-1.5 text-label-tertiary">·</span>
        {reviewCount > 0 ? (
          <span className="inline-flex items-center gap-1 whitespace-nowrap">
            <StarRating rating={Math.round(avgRating)} size="sm" emptyTone="dim" wrapper={false} />
            <span className="ml-1 text-label font-semibold tabular-nums">{ratingText}</span>
            <span className="text-label-tertiary tabular-nums">({reviewCount})</span>
          </span>
        ) : (
          <span className="text-label-tertiary">{t('noReviews')}</span>
        )}
      </p>
    </div>
  );
}
