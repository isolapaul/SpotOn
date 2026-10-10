'use client';

import { useRef, useState, type PointerEvent } from 'react';
import Image from 'next/image';
import { MapPin, ThumbsUp } from 'lucide-react';
import type { Spot } from '@/store/useSpotStore';
import { useT } from '@/hooks/useT';
import type { FeedPhoto } from '@/lib/feed';
import CategoryIcon from '../ui/CategoryIcon';

/** Two taps closer than this (and nearly in place) are a double tap. */
const DOUBLE_TAP_MS = 300;
const TAP_SLOP_PX = 12;
/** The big thumb's show (Tailwind `animate-like-burst`). */
const BURST_MS = 800;
/** Up to this many photos show dots; more show a "2/8" counter. */
const MAX_DOTS = 5;

interface FeedMediaProps {
  spot: Spot;
  photos: FeedPhoto[];
  /** The photo in view (the like and its count follow it). */
  index: number;
  onIndex: (index: number) => void;
  /** A double tap: likes the photo in view (never unlikes). */
  onDoubleTap: () => void;
  /** A photo failed to load: the card drops it (the like keeps following the photo in view). */
  onFailed: (url: string) => void;
  onShowOnMap: () => void;
}

/**
 * A card's photos: a 4:5 swipeable strip (CSS scroll snap), dots or a counter, the "Show on map"
 * pill, and a double tap that likes the photo with a thumb burst. No photo: a tinted tile with
 * the category icon and the name.
 */
export default function FeedMedia({ spot, photos, index, onIndex, onDoubleTap, onFailed, onShowOnMap }: Readonly<FeedMediaProps>) {
  const t = useT();
  const lastTap = useRef<{ at: number; x: number; y: number } | null>(null);
  const [burst, setBurst] = useState(0);
  const shown = photos;

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const now = e.timeStamp;
    const prev = lastTap.current;
    if (prev && now - prev.at < DOUBLE_TAP_MS && Math.hypot(e.clientX - prev.x, e.clientY - prev.y) < TAP_SLOP_PX) {
      lastTap.current = null;
      setBurst((n) => n + 1);
      onDoubleTap();
      return;
    }
    lastTap.current = { at: now, x: e.clientX, y: e.clientY };
  };

  return (
    <div className="relative mx-3 aspect-[4/5] rounded-r3 overflow-hidden bg-surface-2 select-none">
      {shown.length ? (
        <div
          className="absolute inset-0 flex overflow-x-auto snap-x snap-mandatory no-scrollbar overscroll-x-contain touch-manipulation"
          onScroll={(e) => {
            const el = e.currentTarget;
            const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
            if (i !== index) onIndex(Math.min(shown.length - 1, Math.max(0, i)));
          }}
          onPointerUp={onPointerUp}
        >
          {shown.map((photo, i) => (
            <div key={photo.url} className="relative shrink-0 w-full h-full snap-center">
              <Image
                src={photo.url}
                alt={i === 0 ? spot.name : ''}
                fill
                sizes="(max-width: 560px) 100vw, 560px"
                className="object-cover"
                draggable={false}
                onError={() => onFailed(photo.url)}
              />
            </div>
          ))}
        </div>
      ) : (
        <div
          className="absolute inset-0 grid place-items-center bg-linear-to-br from-brand-700/60 via-surface-2 to-surface-1 touch-manipulation"
          onPointerUp={onPointerUp}
        >
          <div className="flex flex-col items-center gap-3 px-8 text-center">
            <span className="w-20 h-20 rounded-full grid place-items-center bg-white/10 motion-safe:animate-badge-pop">
              <CategoryIcon category={spot.category} className="w-11 h-11 text-brand-300" />
            </span>
            <span className="text-label text-[20px] font-bold leading-tight line-clamp-2">{spot.name}</span>
          </div>
        </div>
      )}

      {/* The double tap's thumb, with a ring of sparks */}
      {burst > 0 && (
        <span key={burst} aria-hidden="true" className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="absolute w-28 h-28 rounded-full border-4 border-white/70 motion-safe:animate-ring-ping" />
          <ThumbsUp
            className="w-24 h-24 text-white fill-brand-500 drop-shadow-[0_6px_24px_rgba(0,0,0,0.45)] motion-safe:animate-like-burst opacity-0"
            strokeWidth={1.6}
            style={{ animationDuration: `${BURST_MS}ms` }}
          />
        </span>
      )}

      {/* Position */}
      {shown.length > 1 && shown.length <= MAX_DOTS && (
        <span aria-hidden="true" className="pointer-events-none absolute top-3 inset-x-0 flex justify-center gap-1.5">
          {shown.map((p, i) => (
            <span
              key={p.url}
              className={`h-1.5 rounded-full bg-white shadow transition-all duration-300 ease-ios ${i === index ? 'w-4 opacity-100' : 'w-1.5 opacity-55'}`}
            />
          ))}
        </span>
      )}
      {shown.length > MAX_DOTS && (
        <span className="pointer-events-none absolute top-3 right-3 rounded-full bg-black/55 px-2 py-0.5 text-[12px] font-semibold text-white tabular-nums">
          {index + 1}/{shown.length}
        </span>
      )}

      <button
        type="button"
        onClick={onShowOnMap}
        className="no-min-size absolute left-3 bottom-3 h-9 pl-2.5 pr-3.5 rounded-full material-chrome inline-flex items-center gap-1.5
          text-[14px] font-semibold text-chrome-ink shadow-float touch-manipulation active:scale-95 transition-transform"
      >
        <MapPin className="w-4 h-4 text-brand-600 chrome-dark:text-brand-400 motion-safe:animate-hint-bob" strokeWidth={2.4} aria-hidden="true" />
        {t('showOnMap')}
      </button>
    </div>
  );
}
