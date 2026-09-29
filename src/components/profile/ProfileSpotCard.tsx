'use client';

import { useState, type ReactNode } from 'react';
import Image from 'next/image';
import type { Spot } from '@/store/useSpotStore';
import { getThumbnailUrl, isImageUnoptimized, PLACEHOLDER_URL } from '@/lib/spotImages';
import CategoryIcon from '@/components/ui/CategoryIcon';

interface ProfileSpotCardProps {
  spot: Spot;
  /** The row under the description (status badge in My Spots, rating in Favorites). */
  children: ReactNode;
}

/** Spot card of the My Spots and Favorites tabs (design phase 3): thumbnail, name, description, footer slot. */
export default function ProfileSpotCard({ spot, children }: Readonly<ProfileSpotCardProps>) {
  const url = getThumbnailUrl(spot);
  const [failed, setFailed] = useState(false);
  return (
    <article aria-label={spot.name} className="rounded-[18px] bg-surface-1 p-3 flex gap-3.5">
      <span className="relative w-[72px] h-[72px] flex-shrink-0 rounded-[14px] overflow-hidden bg-brand-500/15 text-brand-400 grid place-items-center">
        {url === PLACEHOLDER_URL || failed ? (
          <CategoryIcon category={spot.category} className="w-8 h-8" />
        ) : (
          <Image src={url} alt="" fill sizes="72px" className="object-cover" unoptimized={isImageUnoptimized(spot)} onError={() => setFailed(true)} />
        )}
      </span>
      <div className="flex-1 min-w-0">
        <h3 className="text-[17px] font-semibold leading-snug text-label line-clamp-1">{spot.name}</h3>
        <p className="text-[14px] text-label-secondary line-clamp-2 mt-0.5">{spot.description}</p>
        {children}
      </div>
    </article>
  );
}
