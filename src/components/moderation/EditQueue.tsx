'use client';

import { ChevronRight } from 'lucide-react';
import { useSpotStore } from '@/store/useSpotStore';
import { useModerationStore } from '@/store/useModerationStore';
import { usePublicProfile } from '@/hooks/usePublicProfile';
import { useT } from '@/hooks/useT';
import type { SpotEdit } from '@/lib/moderation';
import EditDiff from './EditDiff';
import QueueCard from './QueueCard';
import QueueEmpty from './QueueEmpty';

function Proposer({ uid }: Readonly<{ uid: string }>) {
  const t = useT();
  const profile = usePublicProfile(uid);
  return <p className="text-[13px] text-label-tertiary">{t('proposedBy', { name: profile?.username ?? '…' })}</p>;
}

interface EditQueueProps {
  edits: SpotEdit[];
  onOpenSpot: (spotId: string) => void;
}

/** Admin: owners' proposed edits of approved spots, shown as old → new, approved or rejected with a reason. */
export default function EditQueue({ edits, onOpenSpot }: Readonly<EditQueueProps>) {
  const spots = useSpotStore((s) => s.spots);
  const reviewEdit = useModerationStore((s) => s.reviewEdit);
  const t = useT();

  if (edits.length === 0) return <QueueEmpty text={t('noPendingEdits')} />;
  return (
    <div className="space-y-3">
      {edits.map((edit) => {
        const spot = spots.find((s) => s.id === edit.spotId);
        return (
          <QueueCard
            key={edit.spotId}
            label={spot?.name ?? edit.spotName}
            rejectTitle="rejectEditTitle"
            onApprove={() => reviewEdit(edit.spotId, true)}
            onReject={(reason) => reviewEdit(edit.spotId, false, reason)}
            approvedToast="editApprovedToast"
            rejectedToast="editRejectedToast"
          >
            <button
              type="button"
              onClick={() => onOpenSpot(edit.spotId)}
              className="no-min-size w-full text-left flex items-center gap-2 touch-manipulation"
            >
              <span className="flex-1 min-w-0">
                <span className="block text-label font-semibold line-clamp-1">{spot?.name ?? edit.spotName}</span>
                <Proposer uid={edit.ownerId} />
              </span>
              <ChevronRight className="w-5 h-5 text-label-tertiary" aria-hidden="true" />
            </button>
            {spot && <EditDiff spot={spot} proposed={edit.proposed} />}
          </QueueCard>
        );
      })}
    </div>
  );
}
