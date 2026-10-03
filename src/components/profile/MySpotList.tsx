'use client';

import { MapPin } from 'lucide-react';
import type { Spot } from '@/store/useSpotStore';
import { useModerationStore } from '@/store/useModerationStore';
import { useT } from '@/hooks/useT';
import { statusClass, statusLabelKey } from '@/lib/spotStatus';
import type { SpotEdit } from '@/lib/moderation';
import ProfileSpotCard from './ProfileSpotCard';

interface MySpotListProps {
  spots: Spot[];
  onOpenSpot: (spotId: string) => void;
}

/** The review state under a spot (item 4): why it was rejected, or where a proposed edit stands. */
function ReviewNote({ spot, edit }: Readonly<{ spot: Spot; edit?: SpotEdit }>) {
  const t = useT();
  if (spot.status === 'rejected' && spot.rejection) {
    return <span className="block text-[13px] text-[#FF8A80] mt-1.5 line-clamp-2">{t('rejectionReason', { reason: spot.rejection.reason })}</span>;
  }
  if (spot.status !== 'approved' || !edit) return null;
  return (
    <span className="block text-[13px] text-amber-300/90 mt-1.5 line-clamp-2">
      {edit.status === 'pending' ? t('editPendingShort') : t('editRejectedNote', { reason: edit.reason ?? '' })}
    </span>
  );
}

/** All of the user's spots with their status badge (and review state), or the empty state. */
export default function MySpotList({ spots, onOpenSpot }: Readonly<MySpotListProps>) {
  const t = useT();
  const ownEdits = useModerationStore((s) => s.ownEdits);
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
            <ReviewNote spot={spot} edit={ownEdits[spot.id]} />
          </ProfileSpotCard>
        ))
      )}
    </div>
  );
}
