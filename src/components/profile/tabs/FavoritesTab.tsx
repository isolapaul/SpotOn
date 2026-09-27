'use client';

import { Heart } from 'lucide-react';
import type { Spot } from '@/store/useSpotStore';
import { useT } from '@/hooks/useT';
import { averageRating } from '@/lib/rating';
import StarRating from '../../ui/StarRating';
import ProfileSpotCard from '../ProfileSpotCard';

interface FavoritesTabProps {
  spots: Spot[];
}

export default function FavoritesTab({ spots }: Readonly<FavoritesTabProps>) {
  const t = useT();
  return (
    <div className="space-y-4">
      {spots.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <Heart className="w-12 h-12 text-white/40 mx-auto mb-3" />
          <p className="text-white/60">{t('noFavoritesYet')}</p>
          <p className="text-white/40 text-sm mt-1">{t('startSaving')}</p>
        </div>
      ) : (
        spots.map((spot) => {
          const avgRating = averageRating(spot.reviews);
          const reviewCount = spot.reviews?.length || 0;
          return (
            <ProfileSpotCard key={spot.id} spot={spot}>
              <div className="flex items-center gap-1 mt-2">
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
              </div>
            </ProfileSpotCard>
          );
        })
      )}
    </div>
  );
}
