'use client';

import { useEffect, useState } from 'react';
import type { Spot } from '@/store/useSpotStore';
import { useCardDrag } from '@/hooks/useCardDrag';
import { useT } from '@/hooks/useT';
import { Z } from '@/lib/constants';
import PlaceCardContent from './PlaceCardContent';

/** Exit animation length (Tailwind `animate-card-out`). */
const EXIT_MS = 280;

interface PlaceCardProps {
  /** The previewed spot; null slides the card away. */
  spot: Spot | null;
  userLocation: { lat: number; lng: number } | null;
  onClose: () => void;
  onDetails: (spot: Spot) => void;
}

/**
 * The place card (design 1E): slides up from the bottom when a pin is tapped (the launcher leaves
 * at the same time), swaps its content when another pin is tapped, and slides away on close, on a
 * map tap or when dragged down. Pulled up, or its grabber tapped, it opens the spot's details
 * (owner request). It keeps the last spot while it animates out.
 */
export default function PlaceCard({ spot, userLocation, onClose, onDetails }: Readonly<PlaceCardProps>) {
  const [shown, setShown] = useState<Spot | null>(spot);
  const [prev, setPrev] = useState<Spot | null>(spot);
  const [leaving, setLeaving] = useState(false);
  const t = useT();
  const expand = () => {
    if (shown && !leaving) onDetails(shown);
  };
  const drag = useCardDrag(onClose, expand);

  // Follow the prop during render (React's "adjust state when a prop changes" pattern).
  if (spot !== prev) {
    setPrev(spot);
    if (spot) {
      setShown(spot);
      setLeaving(false);
    } else if (shown) {
      setLeaving(true);
    }
  }

  useEffect(() => {
    if (!leaving) return;
    const id = setTimeout(() => {
      setShown(null);
      setLeaving(false);
    }, EXIT_MS);
    return () => clearTimeout(id);
  }, [leaving]);

  if (!shown) return null;

  return (
    <div
      className={`absolute inset-x-2 bottom-2 ${Z.placeCard} mx-auto max-w-[420px] ${
        leaving ? 'motion-safe:animate-card-out pointer-events-none' : 'motion-safe:animate-card-in'
      }`}
      aria-hidden={leaving || undefined}
      inert={leaving}
    >
      <section
        aria-label={shown.name}
        {...drag.handlers}
        className={`material-sheet relative rounded-[28px] shadow-sheet px-4 pt-3 touch-pan-x ${
          drag.dragging ? '' : 'transition-transform duration-350 ease-ios'
        }`}
        style={{
          transform: drag.offset ? `translateY(${drag.offset}px)` : undefined,
          paddingBottom: 'max(16px, calc(env(safe-area-inset-bottom) - 8px))',
        }}
      >
        <button
          type="button"
          onClick={expand}
          aria-label={t('details')}
          className="no-min-size block w-full -mt-3 pt-3 pb-2.5 touch-manipulation group"
        >
          <span aria-hidden="true" className="block mx-auto w-9 h-[5px] rounded-full bg-white/25 transition-colors group-active:bg-white/50" />
        </button>
        <PlaceCardContent
          key={shown.id}
          spot={shown}
          morphSource={!leaving}
          userLocation={userLocation}
          onClose={onClose}
          onDetails={() => onDetails(shown)}
        />
      </section>
    </div>
  );
}
