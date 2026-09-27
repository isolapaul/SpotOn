'use client';

import type { ReactNode } from 'react';
import Image from 'next/image';
import type { Spot } from '@/store/useSpotStore';
import { getThumbnailUrl, isImageUnoptimized } from '@/lib/spotImages';

interface ProfileSpotCardProps {
  spot: Spot;
  /** The row under the description (status badge in My Spots, rating in Favorites). */
  children: ReactNode;
}

/** Spot card of the My Spots and Favorites tabs: thumbnail, name, description and a footer slot. */
export default function ProfileSpotCard({ spot, children }: Readonly<ProfileSpotCardProps>) {
  return (
    <div className="glass-card p-4 flex gap-4">
      <div className="relative w-28 h-28 rounded-xl overflow-hidden flex-shrink-0">
        <Image
          src={getThumbnailUrl(spot)}
          alt={spot.name}
          fill
          sizes="112px"
          className="object-cover"
          unoptimized={isImageUnoptimized(spot)}
        />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-white font-semibold text-base line-clamp-1">{spot.name}</h3>
        <p className="text-white/60 text-sm line-clamp-3 mt-1">{spot.description}</p>
        {children}
      </div>
    </div>
  );
}
