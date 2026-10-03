'use client';

import { useEffect, useState, type MouseEvent } from 'react';
import Image from 'next/image';
import { X, Images } from 'lucide-react';
import type { Spot } from '@/store/useSpotStore';
import { useT } from '@/hooks/useT';
import BackButton, { type SpotBack } from '@/components/ui/BackButton';
import CategoryIcon from '@/components/ui/CategoryIcon';
import { isImageUnoptimized } from '@/lib/spotImages';
import { DELAYS } from '@/lib/constants';

interface SpotHeroProps {
  spot: Spot;
  heroImageUrl: string;
  /** Other images of the spot, tried in order when the hero image fails to load. */
  fallbackUrls: readonly string[];
  /** Number of gallery images: the hero opens the gallery only when there is one. */
  imageCount: number;
  onOpenGallery: () => void;
  onClose: () => void;
  /** Opened from a list: a back capsule to it replaces Close (a pull down still closes). */
  back?: SpotBack;
  /** The compact bar's Close is in charge (the hero scrolled away): this one leaves the a11y tree. */
  closeHidden?: boolean;
}

/**
 * Hero image (design phase 3): full-bleed, opens the gallery; close on the top left and the photo
 * count at the bottom right. The actions (directions, save, highlight, share) moved to SpotActions.
 */
export default function SpotHero({ spot, heroImageUrl, fallbackUrls, imageCount, onOpenGallery, onClose, back, closeHidden }: Readonly<SpotHeroProps>) {
  const t = useT();
  // A few stored images do not load (owner report): try the spot's other images, then show the
  // category glyph instead of the browser's broken-image icon.
  const [failed, setFailed] = useState<readonly string[]>([]);
  const imageUrl = [heroImageUrl, ...fallbackUrls].find((url) => !failed.includes(url)) ?? null;

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

  // BUG-26: Close sits inside the clickable hero; stop the click there so it does not also open
  // the gallery.
  const handleClose = (e: MouseEvent) => {
    e.stopPropagation();
    onClose();
  };
  const handleBack = (e: MouseEvent) => {
    e.stopPropagation();
    back?.onBack();
  };

  return (
    <div
      className="relative w-full flex-shrink-0 pointer-events-auto cursor-pointer bg-surface-2"
      style={{ height: 'min(46vh, 420px)' }}
      onClick={openGallery}
      role="button"
      tabIndex={0}
      data-vt-hero=""
      onKeyDown={(e) => e.key === 'Enter' && e.target === e.currentTarget && openGallery()}
    >
      {imageUrl ? (
        <Image
          key={imageUrl}
          src={imageUrl}
          alt={spot.name}
          fill
          sizes="100vw"
          className="object-cover"
          priority
          unoptimized={isImageUnoptimized(spot)}
          onError={() => setFailed((f) => [...f, imageUrl])}
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-brand-700/40 to-surface-2 text-brand-300">
          <CategoryIcon category={spot.category} className="w-16 h-16" />
        </div>
      )}
      <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/40 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-[30%] bg-gradient-to-t from-surface-0/80 to-transparent" />

      {back ? (
        <BackButton
          label={back.label}
          ariaLabel={back.ariaLabel}
          onClick={handleBack}
          tone="overlay"
          hidden={closeHidden}
          className="absolute left-3"
          style={{ top: 'calc(env(safe-area-inset-top, 0px) + 10px)' }}
        />
      ) : (
      <button
        onClick={handleClose}
        className="no-min-size absolute left-3 w-11 h-11 grid place-items-center rounded-full touch-manipulation active:scale-90 transition-transform"
        style={{ top: 'calc(env(safe-area-inset-top, 0px) + 6px)' }}
        aria-label="Close"
        aria-hidden={closeHidden || undefined}
        tabIndex={closeHidden ? -1 : undefined}
      >
        <span className="w-9 h-9 rounded-full grid place-items-center bg-black/35 backdrop-blur-md">
          <X className="w-[18px] h-[18px] text-white" strokeWidth={2.5} />
        </span>
      </button>
      )}

      {imageCount > 1 && (
        <div
          role="img"
          aria-label={t('photoCount', { count: imageCount })}
          className="absolute bottom-3 right-3 h-7 px-2.5 rounded-full bg-black/45 backdrop-blur-md text-white text-[13px] font-semibold flex items-center gap-1.5 tabular-nums"
        >
          <Images className="w-3.5 h-3.5" aria-hidden="true" />
          {imageCount}
        </div>
      )}
    </div>
  );
}
