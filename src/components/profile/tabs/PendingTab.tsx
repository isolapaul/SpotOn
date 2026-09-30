'use client';

import { ChevronRight, Clock, Shield } from 'lucide-react';
import Image from 'next/image';
import { useSpotStore, type Spot } from '@/store/useSpotStore';
import { useToastStore } from '@/store/useToastStore';
import { useT } from '@/hooks/useT';
import { getThumbnailUrl, isImageUnoptimized } from '@/lib/spotImages';

interface PendingTabProps {
  spots: Spot[];
  onOpenSpot: (spotId: string) => void;
}

/** Admin: pending spots with an approve button each. */
export default function PendingTab({ spots, onOpenSpot }: Readonly<PendingTabProps>) {
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
            <button
              type="button"
              onClick={() => onOpenSpot(spot.id)}
              aria-label={spot.name}
              className="no-min-size w-full text-left flex gap-4 mb-3 touch-manipulation transition-transform duration-150 active:scale-[.98]"
            >
              <span className="relative w-20 h-20 rounded-xl overflow-hidden flex-shrink-0">
                <Image
                  src={getThumbnailUrl(spot)}
                  alt={spot.name}
                  fill
                  sizes="80px"
                  className="object-cover"
                  unoptimized={isImageUnoptimized(spot)}
                />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-white font-semibold line-clamp-1">{spot.name}</span>
                <span className="block text-white/60 text-sm line-clamp-2">{spot.description}</span>
                <span className="flex items-center gap-2 mt-2">
                  <span className="text-xs px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-400 inline-flex items-center gap-1">
                    <Clock className="w-3 h-3" aria-hidden="true" />
                    {t('pendingApproval')}
                  </span>
                  <span className="text-white/50 text-xs">
                    {spot.createdByName}
                  </span>
                </span>
              </span>
              <ChevronRight className="w-5 h-5 flex-shrink-0 self-center text-white/40" aria-hidden="true" />
            </button>

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
