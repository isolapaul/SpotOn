'use client';

import { Heart, ListPlus, MoreHorizontal, Navigation, Share, Sparkles } from 'lucide-react';
import { useState } from 'react';
import ListPicker from '../lists/ListPicker';
import type { Spot } from '@/store/useSpotStore';
import { useUserStore } from '@/store/useUserStore';
import { useT } from '@/hooks/useT';
import { useFavoriteToggle } from '@/hooks/useFavoriteToggle';
import { useShareSpot } from '@/hooks/useShareSpot';
import { spotOverflowActions, type SpotOverflowAction } from '@/lib/spotActions';
import type { SpotHighlight } from './useSpotHighlight';
import SpotMoreSheet, { type SpotMoreItem } from './SpotMoreSheet';

interface SpotActionsProps {
  spot: Spot;
  navigationUrl: string;
  highlight: SpotHighlight;
}

/** The round secondary buttons, as the place card's heart (50 pt high, wider than tall). */
const ROUND = `no-min-size w-[58px] h-[50px] shrink-0 rounded-full grid place-items-center bg-white/10 text-label
  touch-manipulation active:scale-90 transition-transform duration-150 disabled:opacity-40
  focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-400`;

/**
 * The action row under the title, as the place card: one wide Directions pill, the favourite heart
 * and "More" (save to a list, share, highlight). When only one of those applies (signed out: share)
 * it shows as its own round button instead of a sheet with a single row.
 */
export default function SpotActions({ spot, navigationUrl, highlight }: Readonly<SpotActionsProps>) {
  const t = useT();
  const user = useUserStore((s) => s.user);
  const favorite = useFavoriteToggle(spot.id);
  const shareSpot = useShareSpot();
  const [picking, setPicking] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const actions = spotOverflowActions({
    signedIn: !!user,
    isOwner: !!user && spot.createdBy === user.uid,
    approved: spot.status === 'approved',
  });
  const item = (action: SpotOverflowAction): SpotMoreItem => {
    switch (action) {
      case 'list':
        return { key: action, label: t('saveToList'), icon: <ListPlus className="w-5 h-5 text-label" />, onSelect: () => setPicking(true) };
      case 'share':
        return { key: action, label: t('share'), icon: <Share className="w-5 h-5 text-label" />, onSelect: () => void shareSpot(spot) };
      case 'highlight':
        return {
          key: action,
          label: t('highlightSpot'),
          note: highlight.isHighlightedByUser ? t('youHighlightedThis') : undefined,
          icon: <Sparkles className={`w-5 h-5 text-gold ${highlight.isHighlightedByUser ? 'fill-gold' : ''}`} />,
          pressed: highlight.isHighlightedByUser,
          disabled: highlight.isHighlighting || highlight.isHighlightedByUser,
          onSelect: () => void highlight.highlight(),
        };
    }
  };
  const items = actions.map(item);
  const single = items.length === 1 ? items[0] : null;

  return (
    <div className="flex gap-2">
      <a
        href={navigationUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-1 min-w-0 h-[50px] px-4 rounded-full flex items-center justify-center gap-2 bg-brand-600 text-white
          font-semibold text-[16px] touch-manipulation active:scale-[.97] transition-transform duration-150
          focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-400"
      >
        <Navigation className="w-[18px] h-[18px] shrink-0" strokeWidth={2.2} aria-hidden="true" />
        {t('directions')}
      </a>
      {favorite.canToggle && (
        <button
          type="button"
          onClick={() => void favorite.toggle()}
          aria-label={favorite.isFavorite ? t('removeFromFavorites') : t('addToFavorites')}
          aria-pressed={favorite.isFavorite}
          className={ROUND}
        >
          <Heart
            key={String(favorite.isFavorite)}
            className={`w-5 h-5 ${favorite.isFavorite ? 'fill-[#FF375F] text-[#FF375F] motion-safe:animate-badge-pop' : ''}`}
            strokeWidth={2}
            aria-hidden="true"
          />
        </button>
      )}
      {single && (
        <button
          type="button"
          onClick={single.onSelect}
          aria-label={single.label}
          aria-pressed={single.pressed}
          disabled={single.disabled}
          className={ROUND}
        >
          {single.icon}
        </button>
      )}
      {items.length > 1 && (
        <button type="button" onClick={() => setMoreOpen(true)} aria-label={t('moreActions')} aria-haspopup="dialog" className={ROUND}>
          <MoreHorizontal className="w-5 h-5" aria-hidden="true" />
        </button>
      )}
      {moreOpen && <SpotMoreSheet title={spot.name} items={items} onClose={() => setMoreOpen(false)} />}
      {picking && <ListPicker spotId={spot.id} onClose={() => setPicking(false)} />}
    </div>
  );
}
