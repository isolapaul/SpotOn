'use client';

import Image from 'next/image';
import { ChevronRight, Clock } from 'lucide-react';
import { useSpotStore, type Spot } from '@/store/useSpotStore';
import { useModerationStore } from '@/store/useModerationStore';
import { useT } from '@/hooks/useT';
import { getThumbnailUrl, isImageUnoptimized } from '@/lib/spotImages';
import QueueCard from './QueueCard';
import QueueEmpty from './QueueEmpty';

interface SpotQueueProps {
  spots: Spot[];
  onOpenSpot: (spotId: string) => void;
}

/** Admin: new and resubmitted spots, each opened on the map by a tap, approved or rejected with a reason. */
export default function SpotQueue({ spots, onOpenSpot }: Readonly<SpotQueueProps>) {
  const approveSpot = useSpotStore((s) => s.approveSpot);
  const rejectSpot = useModerationStore((s) => s.rejectSpot);
  const t = useT();

  if (spots.length === 0) return <QueueEmpty text={t('noPendingSpots')} />;
  return (
    <div className="space-y-3">
      {spots.map((spot) => (
        <QueueCard
          key={spot.id}
          label={spot.name}
          rejectTitle="rejectSpotTitle"
          onApprove={() => approveSpot(spot.id)}
          onReject={(reason) => rejectSpot(spot.id, reason)}
          approvedToast="spotApproved"
          rejectedToast="spotRejectedToast"
        >
          <button
            type="button"
            onClick={() => onOpenSpot(spot.id)}
            aria-label={spot.name}
            className="no-min-size w-full text-left flex gap-4 touch-manipulation transition-transform duration-150 active:scale-[.98]"
          >
            <span className="relative w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-surface-3">
              <Image src={getThumbnailUrl(spot)} alt="" fill sizes="80px" className="object-cover" unoptimized={isImageUnoptimized(spot)} />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-label font-semibold line-clamp-1">{spot.name}</span>
              <span className="block text-label-secondary text-sm line-clamp-2">{spot.description}</span>
              <span className="flex items-center gap-2 mt-2">
                <span className="text-xs px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-400 inline-flex items-center gap-1">
                  <Clock className="w-3 h-3" aria-hidden="true" />
                  {t('pendingApproval')}
                </span>
                <span className="text-label-tertiary text-xs truncate">{spot.createdByName}</span>
              </span>
            </span>
            <ChevronRight className="w-5 h-5 shrink-0 self-center text-label-tertiary" aria-hidden="true" />
          </button>
        </QueueCard>
      ))}
    </div>
  );
}
