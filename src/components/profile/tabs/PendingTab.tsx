'use client';

import { Clock, Shield } from 'lucide-react';
import Image from 'next/image';
import { useSpotStore, type Spot } from '@/store/useSpotStore';
import { useToastStore } from '@/store/useToastStore';
import { useT } from '@/hooks/useT';
import { getThumbnailUrl, isImageUnoptimized } from '@/lib/spotImages';

interface PendingTabProps {
  spots: Spot[];
}

/** Admin: pending spots with an approve button each. */
export default function PendingTab({ spots }: Readonly<PendingTabProps>) {
  const approveSpot = useSpotStore((s) => s.approveSpot);
  const { showToast } = useToastStore();
  const t = useT();

  const handleApproveSpot = async (spotId: string) => {
    try {
      await approveSpot(spotId);
    } catch (error) {
      console.error('Failed to approve spot:', error);
      showToast(t('approveError'), 'error');
    }
  };

  return (
    <div className="space-y-4">
      {spots.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <Clock className="w-12 h-12 text-white/40 mx-auto mb-3" />
          <p className="text-white/60">{t('noPendingSpots')}</p>
          <p className="text-white/40 text-sm mt-1">{t('allSpotsApproved')}</p>
        </div>
      ) : (
        spots.map((spot) => (
          <div key={spot.id} className="glass-card p-4">
            <div className="flex gap-4 mb-3">
              <div className="relative w-20 h-20 rounded-xl overflow-hidden flex-shrink-0">
                <Image
                  src={getThumbnailUrl(spot)}
                  alt={spot.name}
                  fill
                  sizes="80px"
                  className="object-cover"
                  unoptimized={isImageUnoptimized(spot)}
                />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-white font-semibold line-clamp-1">{spot.name}</h3>
                <p className="text-white/60 text-sm line-clamp-2">{spot.description}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-400">
                    ⏳ {t('pendingApproval')}
                  </span>
                  <span className="text-white/50 text-xs">
                    {spot.createdByName}
                  </span>
                </div>
              </div>
            </div>

            {/* Approve Button */}
            <button
              onClick={() => handleApproveSpot(spot.id)}
              className="w-full py-2.5 px-4 rounded-xl font-semibold text-sm
                bg-green-500/20 text-green-400 border border-green-500/30
                hover:bg-green-500/30 active:scale-98
                transition-all duration-200 flex items-center justify-center gap-2"
            >
              <Shield className="w-4 h-4" />
              <span>{t('approve')}</span>
            </button>
          </div>
        ))
      )}
    </div>
  );
}
