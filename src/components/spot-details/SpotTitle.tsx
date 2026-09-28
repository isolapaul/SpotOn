'use client';

import { Pencil } from 'lucide-react';
import type { Spot } from '@/store/useSpotStore';
import { useT } from '@/hooks/useT';
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
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        {edit.isEditing ? (
          <input
            type="text"
            value={edit.editName}
            onChange={(e) => edit.setEditName(e.target.value)}
            maxLength={100}
            className="text-2xl font-bold text-white bg-white/10 border border-white/20 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 flex-1 mr-2"
          />
        ) : (
          <h1 className="text-3xl font-bold text-white flex items-center gap-2">
            {spot.name}
            {isHighlightedByUser && <span className="text-yellow-400 animate-pulse" title={t('spotHasHighlight')}>⭐</span>}
          </h1>
        )}
        {canEdit && !edit.isEditing && (
          <button
            onClick={edit.start}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors flex-shrink-0"
            aria-label={t('editSpot')}
          >
            <Pencil className="w-4 h-4 text-white/70" />
          </button>
        )}
      </div>
      <div className="flex items-center gap-3">
        <StarRating rating={Math.round(avgRating)} size="md" emptyTone="dim" />
        <span className="text-white font-semibold">{avgRating > 0 ? avgRating.toFixed(1) : '-'}</span>
        <span className="text-white/60">({spot.reviews?.length || 0} {t('reviews')})</span>
      </div>
    </div>
  );
}
