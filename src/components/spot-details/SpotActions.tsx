'use client';

import type { ReactNode } from 'react';
import { Heart, Navigation, Share2, Sparkles } from 'lucide-react';
import type { Spot } from '@/store/useSpotStore';
import { useUserStore } from '@/store/useUserStore';
import { useT } from '@/hooks/useT';
import { useFavoriteToggle } from '@/hooks/useFavoriteToggle';
import type { SpotHighlight } from './useSpotHighlight';

interface SpotActionsProps {
  spot: Spot;
  navigationUrl: string;
  highlight: SpotHighlight;
}

const TILE = `no-min-size flex-1 min-w-0 h-14 rounded-[14px] flex flex-col items-center justify-center gap-1 text-[12px] font-semibold
  touch-manipulation active:scale-[.97] transition-transform duration-150 disabled:opacity-40`;

function Tile({ label, ariaLabel, onClick, children, pressed, disabled }: Readonly<{
  label: string;
  ariaLabel?: string;
  onClick: () => void;
  children: ReactNode;
  pressed?: boolean;
  disabled?: boolean;
}>) {
  return (
    <button type="button" onClick={onClick} aria-label={ariaLabel} aria-pressed={pressed} disabled={disabled} className={`${TILE} bg-white/[.08] text-label`}>
      {children}
      <span className="truncate max-w-full px-1">{label}</span>
    </button>
  );
}

/** The action row under the title (design phase 3, Apple Maps style): directions, save, highlight, share. */
export default function SpotActions({ spot, navigationUrl, highlight }: Readonly<SpotActionsProps>) {
  const t = useT();
  const user = useUserStore((s) => s.user);
  const favorite = useFavoriteToggle(spot.id);
  const isOwner = !!user && spot.createdBy === user.uid;

  const share = async () => {
    if (!navigator.share) return;
    try {
      await navigator.share({ title: spot.name, text: spot.description, url: globalThis.location.href });
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') console.error('Share error:', err);
    }
  };

  return (
    <div className="flex gap-2">
      <a href={navigationUrl} target="_blank" rel="noopener noreferrer" className={`${TILE} bg-brand-600 text-white`}>
        <Navigation className="w-5 h-5" aria-hidden="true" />
        <span className="truncate max-w-full px-1">{t('directions')}</span>
      </a>
      {favorite.canToggle && (
        <Tile
          label={t('saveSpot')}
          ariaLabel={favorite.isFavorite ? t('removeFromFavorites') : t('addToFavorites')}
          pressed={favorite.isFavorite}
          onClick={() => void favorite.toggle()}
        >
          <Heart
            key={String(favorite.isFavorite)}
            className={`w-5 h-5 ${favorite.isFavorite ? 'fill-[#FF375F] text-[#FF375F] motion-safe:animate-badge-pop' : ''}`}
            aria-hidden="true"
          />
        </Tile>
      )}
      {isOwner && (
        <Tile
          label={t('highlightShort')}
          ariaLabel={t('highlightSpot')}
          pressed={highlight.isHighlightedByUser}
          disabled={highlight.isHighlighting || highlight.isHighlightedByUser}
          onClick={() => void highlight.highlight()}
        >
          <Sparkles className={`w-5 h-5 ${highlight.isHighlightedByUser ? 'text-gold fill-gold' : 'text-gold'}`} aria-hidden="true" />
        </Tile>
      )}
      <Tile label={t('share')} onClick={() => void share()}>
        <Share2 className="w-5 h-5" aria-hidden="true" />
      </Tile>
    </div>
  );
}
