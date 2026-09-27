'use client';

import { useEffect, useState, type MouseEvent } from 'react';
import Image from 'next/image';
import { X, Heart, Share2, Sparkles } from 'lucide-react';
import type { Spot } from '@/store/useSpotStore';
import { useUserStore } from '@/store/useUserStore';
import { useT } from '@/hooks/useT';
import { useFavoriteToggle } from '@/hooks/useFavoriteToggle';
import { categoryEmojis, categoryTranslationKeys } from '@/lib/spotUtils';
import { isImageUnoptimized } from '@/lib/spotImages';
import { DELAYS } from '@/lib/constants';
import type { SpotHighlight } from './useSpotHighlight';

interface SpotHeroProps {
  spot: Spot;
  heroImageUrl: string;
  /** Number of gallery images: the hero opens the gallery only when there is one. */
  imageCount: number;
  onOpenGallery: () => void;
  onClose: () => void;
  highlight: SpotHighlight;
}

/** Hero image (opens the fullscreen gallery) with the top action bar and the category badge. */
export default function SpotHero({ spot, heroImageUrl, imageCount, onOpenGallery, onClose, highlight }: Readonly<SpotHeroProps>) {
  const user = useUserStore((s) => s.user);
  const t = useT();
  // BUG-09: favourite state comes from the store (user.savedSpots), not a copy of the props.
  const favorite = useFavoriteToggle(spot.id);
  const { isHighlightedByUser, isHighlighting } = highlight;

  // Ignore hero clicks briefly after a spot is shown (prevents an accidental gallery open).
  // `readyFor` is the spot whose guard has elapsed; it is dropped during render when the spot
  // changes, and the effect only schedules the release.
  const [readyFor, setReadyFor] = useState<string | null>(null);
  if (readyFor !== null && readyFor !== spot.id) setReadyFor(null);
  const ignoreHeroClicks = readyFor !== spot.id;
  useEffect(() => {
    const id = setTimeout(() => setReadyFor(spot.id), DELAYS.heroClickGuard);
    return () => clearTimeout(id);
  }, [spot.id]);

  const openGallery = () => !ignoreHeroClicks && imageCount > 0 && onOpenGallery();

  // BUG-26: Close and the heart sit inside the clickable hero; stop the click there so it
  // does not also open the gallery.
  const handleClose = (e: MouseEvent) => {
    e.stopPropagation();
    onClose();
  };
  const handleFavorite = (e: MouseEvent) => {
    e.stopPropagation();
    void favorite.toggle();
  };

  const handleShare = async () => {
    if (!navigator.share) return;
    try {
      await navigator.share({ title: spot.name, text: spot.description, url: globalThis.location.href });
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') console.error('Share error:', err);
    }
  };

  return (
    <div
      className="relative w-full h-[40vh] flex-shrink-0 pointer-events-auto cursor-pointer"
      onClick={openGallery}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && e.target === e.currentTarget && openGallery()}
    >
      <Image src={heroImageUrl} alt={spot.name} fill sizes="100vw" className="object-cover" priority unoptimized={isImageUnoptimized(spot)} />
      {imageCount > 1 && (
        <div className="absolute bottom-4 right-4 bg-black/60 text-white text-sm px-3 py-1.5 rounded-full flex items-center gap-1">
          📸 {imageCount}
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-slate-900/80" />

      {/* Top action bar */}
      <div className="absolute left-4 right-4 flex justify-between items-center" style={{ top: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}>
        <button onClick={handleClose} className="glass-button p-3 rounded-full touch-manipulation min-w-[48px] min-h-[48px]" aria-label="Close">
          <X className="w-5 h-5 text-white" />
        </button>
        <div className="flex gap-2">
          {favorite.canToggle && (
            <button onClick={handleFavorite} className="glass-button p-3 rounded-full touch-manipulation min-w-[48px] min-h-[48px]" aria-label={favorite.isFavorite ? 'Remove from favorites' : 'Add to favorites'}>
              <Heart className={`w-5 h-5 ${favorite.isFavorite ? 'fill-red-500 text-red-500' : 'text-white'}`} />
            </button>
          )}
          {user && spot.createdBy === user.uid && (
            <button
              onClick={(e) => { e.stopPropagation(); void highlight.highlight(); }}
              disabled={isHighlighting || isHighlightedByUser}
              className={`glass-button p-3 rounded-full touch-manipulation min-w-[48px] min-h-[48px] transition-all ${isHighlightedByUser ? 'opacity-50 cursor-not-allowed' : 'hover:bg-yellow-500/20 active:scale-95'}`}
              aria-label={t('highlightSpot')}
              title={isHighlightedByUser ? t('youHighlightedThis') : t('highlightSpot')}
            >
              <Sparkles className={`w-5 h-5 ${isHighlightedByUser ? 'text-yellow-500 fill-yellow-500' : 'text-white'}`} />
            </button>
          )}
          <button onClick={(e) => { e.stopPropagation(); void handleShare(); }} className="glass-button p-3 rounded-full" aria-label="Share">
            <Share2 className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>

      {/* Category badge */}
      <div className="absolute bottom-4 left-4">
        <div className="glass-card px-4 py-2 flex items-center gap-2">
          <span className="text-2xl">{categoryEmojis[spot.category]}</span>
          <span className="text-white font-medium">{t(categoryTranslationKeys[spot.category])}</span>
        </div>
      </div>
    </div>
  );
}
