'use client';

import { MapPin } from 'lucide-react';
import type { Spot } from '@/store/useSpotStore';
import { useT } from '@/hooks/useT';
import { statusClass, statusLabelKey } from '@/lib/spotStatus';
import ProfileSpotCard from './ProfileSpotCard';

interface MySpotListProps {
  spots: Spot[];
  onOpenSpot: (spotId: string) => void;
}

/** All of the user's spots with their status badge, or the empty state. */
export default function MySpotList({ spots, onOpenSpot }: Readonly<MySpotListProps>) {
  const t = useT();
  return (
    <div className="space-y-3">
      {spots.length === 0 ? (
        <div className="rounded-[18px] bg-surface-1 px-6 py-10 text-center">
          <span className="mx-auto mb-3 w-14 h-14 rounded-2xl grid place-items-center bg-brand-500/15 text-brand-400">
            <MapPin className="w-7 h-7" />
          </span>
          <p className="text-[17px] font-semibold text-label">{t('noSpotsYet')}</p>
          <p className="text-[14px] text-label-secondary mt-1">{t('startExploring')}</p>
        </div>
      ) : (
        spots.map((spot) => (
          <ProfileSpotCard key={spot.id} spot={spot} onOpen={() => onOpenSpot(spot.id)}>
            <span className="flex items-center gap-2 mt-2">
              <span className={`text-xs px-2 py-1 rounded-full ${statusClass(spot.status)}`}>
                {t(statusLabelKey(spot.status))}
              </span>
            </span>
          </ProfileSpotCard>
        ))
      )}
    </div>
  );
}
