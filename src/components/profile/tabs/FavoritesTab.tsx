'use client';

import { Heart } from 'lucide-react';
import type { Spot } from '@/store/useSpotStore';
import { useT } from '@/hooks/useT';
import { averageRating } from '@/lib/rating';
import StarRating from '../../ui/StarRating';
import ProfileSpotCard from '../ProfileSpotCard';

interface FavoritesTabProps {
  spots: Spot[];
  onOpenSpot: (spotId: string) => void;
}

export default function FavoritesTab({ spots, onOpenSpot }: Readonly<FavoritesTabProps>) {
  const t = useT();
  return (
    <div className="space-y-3">
      {spots.length === 0 ? (
        <div className="rounded-[18px] bg-surface-1 px-6 py-10 text-center">
          <span className="mx-auto mb-3 w-14 h-14 rounded-2xl grid place-items-center bg-[#FF375F]/15 text-[#FF375F]">
            <Heart className="w-7 h-7" />
          </span>
          <p className="text-[17px] font-semibold text-label">{t('noFavoritesYet')}</p>
          <p className="text-[14px] text-label-secondary mt-1">{t('startSaving')}</p>
        </div>
      ) : (
        spots.map((spot) => {
          const avgRating = averageRating(spot.reviews);
          const reviewCount = spot.reviews?.length || 0;
          return (
            <ProfileSpotCard key={spot.id} spot={spot} onOpen={() => onOpenSpot(spot.id)}>
              <span className="flex items-center gap-1 mt-2">
                {avgRating > 0 ? (
                  <>
                    <StarRating rating={Math.round(avgRating)} size="xs" emptyTone="faint" />
                    <span className="text-white/70 text-xs ml-1">
                      {avgRating.toFixed(1)} ({reviewCount})
                    </span>
                  </>
                ) : (
                  <span className="text-white/40 text-xs">{t('noReviews')}</span>
                )}
              </span>
            </ProfileSpotCard>
          );
        })
      )}
    </div>
  );
}
