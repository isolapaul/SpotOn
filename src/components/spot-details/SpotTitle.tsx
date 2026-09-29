'use client';

import { Pencil, Star } from 'lucide-react';
import type { Spot } from '@/store/useSpotStore';
import { useLanguage, useT } from '@/hooks/useT';
import { categoryTranslationKeys } from '@/lib/spotUtils';
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

/** Title (or the name input while editing), highlight star, edit button and the rating row. */
export default function SpotTitle({ spot, avgRating, canEdit, edit, isHighlightedByUser }: Readonly<SpotTitleProps>) {
  const t = useT();
  const language = useLanguage();
  const ratingText = avgRating > 0 ? (language === 'en' ? avgRating.toFixed(1) : avgRating.toFixed(1).replace('.', ',')) : '-';
  return (
    <div>
      <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-brand-500/15 text-brand-300 text-[13px] font-semibold mb-2">
        <CategoryIcon category={spot.category} className="w-3.5 h-3.5" />
        {t(categoryTranslationKeys[spot.category])}
      </span>
      <div className="flex items-start justify-between gap-2 mb-1.5">
        {edit.isEditing ? (
          <input
            type="text"
            value={edit.editName}
            onChange={(e) => edit.setEditName(e.target.value)}
            maxLength={100}
            className="text-2xl font-bold text-white bg-white/10 border border-white/20 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 flex-1 mr-2"
          />
        ) : (
          <h1 className="text-[28px] leading-tight font-bold text-label flex items-center gap-2">
            {spot.name}
            {isHighlightedByUser && (
              <Star className="w-6 h-6 text-gold fill-gold motion-safe:animate-badge-pop" aria-label={t('spotHasHighlight')} role="img" />
            )}
          </h1>
        )}
        {canEdit && !edit.isEditing && (
          <button
            onClick={edit.start}
            className="no-min-size w-9 h-9 grid place-items-center rounded-full bg-white/10 active:bg-white/20 transition-colors flex-shrink-0"
            aria-label={t('editSpot')}
          >
            <Pencil className="w-4 h-4 text-white/70" />
          </button>
        )}
      </div>
      <div className="flex items-center gap-2 text-[15px]">
        <StarRating rating={Math.round(avgRating)} size="sm" emptyTone="dim" />
        <span className="text-label font-semibold tabular-nums">{ratingText}</span>
        <span className="text-label-secondary tabular-nums">· {spot.reviews?.length || 0} {t('reviews')}</span>
      </div>
    </div>
  );
}
