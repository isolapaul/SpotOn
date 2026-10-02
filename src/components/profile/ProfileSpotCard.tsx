'use client';

import { useState, type ReactNode } from 'react';
import Image from 'next/image';
import { ChevronRight } from 'lucide-react';
import type { Spot } from '@/store/useSpotStore';
import { getThumbnailUrl, isImageUnoptimized, PLACEHOLDER_URL } from '@/lib/spotImages';
import CategoryIcon from '@/components/ui/CategoryIcon';

interface ProfileSpotCardProps {
  spot: Spot;
  /** Opens the spot on the map (the profile closes first). */
  onOpen: () => void;
  /** The row under the description (status badge in My Spots, rating in Favorites). */
  children: ReactNode;
}

/** Spot card of the My Spots and Favorites tabs (design phase 3): thumbnail, name, description, footer slot; tap to open. */
export default function ProfileSpotCard({ spot, onOpen, children }: Readonly<ProfileSpotCardProps>) {
  const url = getThumbnailUrl(spot);
  const [failed, setFailed] = useState(false);
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={spot.name}
      className="no-min-size w-full text-left rounded-[18px] bg-surface-1 p-3 flex items-center gap-3.5 touch-manipulation
        transition-transform duration-150 ease-ios active:scale-[.98] active:bg-surface-2"
    >
      <span className="relative w-[72px] h-[72px] shrink-0 rounded-r2 overflow-hidden bg-brand-500/15 text-brand-400 grid place-items-center">
        {url === PLACEHOLDER_URL || failed ? (
          <CategoryIcon category={spot.category} className="w-8 h-8" />
        ) : (
          <Image src={url} alt="" fill sizes="72px" className="object-cover" unoptimized={isImageUnoptimized(spot)} onError={() => setFailed(true)} />
        )}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[17px] font-semibold leading-snug text-label line-clamp-1">{spot.name}</span>
        <span className="block text-[14px] text-label-secondary line-clamp-2 mt-0.5">{spot.description}</span>
        {children}
      </span>
      <ChevronRight className="w-5 h-5 shrink-0 text-label-tertiary" aria-hidden="true" />
    </button>
  );
}
