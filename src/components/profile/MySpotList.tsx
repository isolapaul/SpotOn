'use client';

import { MapPin } from 'lucide-react';
import type { Spot } from '@/store/useSpotStore';
import { useT } from '@/hooks/useT';
import { statusClass, statusLabelKey } from '@/lib/spotStatus';
import ProfileSpotCard from './ProfileSpotCard';

interface MySpotListProps {
  spots: Spot[];
}

/** All of the user's spots with their status badge, or the empty state. */
export default function MySpotList({ spots }: Readonly<MySpotListProps>) {
  const t = useT();
  return (
    <div className="space-y-4">
      {spots.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <MapPin className="w-12 h-12 text-white/40 mx-auto mb-3" />
          <p className="text-white/60">{t('noSpotsYet')}</p>
          <p className="text-white/40 text-sm mt-1">{t('startExploring')}</p>
        </div>
      ) : (
        spots.map((spot) => (
          <ProfileSpotCard key={spot.id} spot={spot}>
            <div className="flex items-center gap-2 mt-2">
              <span className={`text-xs px-2 py-1 rounded-full ${statusClass(spot.status)}`}>
                {t(statusLabelKey(spot.status))}
              </span>
            </div>
          </ProfileSpotCard>
        ))
      )}
    </div>
  );
}
