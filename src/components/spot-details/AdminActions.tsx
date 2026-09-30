'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCircle, Trash2, XCircle } from 'lucide-react';
import { useSpotStore, type Spot } from '@/store/useSpotStore';
import { useModerationStore } from '@/store/useModerationStore';
import { useToastStore } from '@/store/useToastStore';
import { useT } from '@/hooks/useT';
import { DELAYS } from '@/lib/constants';
import { statusClass, statusLabelKey } from '@/lib/spotStatus';
import Button from '../ui/Button';
import ReasonSheet from '../moderation/ReasonSheet';

// Admin-only parts of the details panel. UI only: the rules and the moderation callables enforce
// them. Two exports because they sit at different DOM positions (status card first, delete button
// after the image manager).

interface AdminActionProps {
  spot: Spot;
  /** Closes the details panel. */
  onClose: () => void;
}

/**
 * Status pill and, for a pending spot, Approve (closes the panel 1 s after a successful approve) and
 * Reject with a reason (item 4). A rejected spot shows the reason it was given.
 */
export function AdminStatusCard({ spot, onClose }: Readonly<AdminActionProps>) {
  const approveSpot = useSpotStore((s) => s.approveSpot);
  const rejectSpot = useModerationStore((s) => s.rejectSpot);
  const showToast = useToastStore((s) => s.showToast);
  const t = useT();
  const [isApproving, setIsApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const approveCloseTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const shownSpotIdRef = useRef<string | undefined>(undefined);

  // T21: cancel a pending close-after-approve when the shown spot changes or the panel closes
  // (this card unmounts then), and forget the shown id so a late approve does not arm the timer.
  useEffect(() => {
    shownSpotIdRef.current = spot.id;
    return () => {
      shownSpotIdRef.current = undefined;
      clearTimeout(approveCloseTimerRef.current);
    };
  }, [spot.id]);

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      const approvedId = spot.id;
      await approveSpot(approvedId);
      showToast(t('spotApproved'), 'success');
      // Another spot may have been opened while the write was pending: only close the approved one.
      if (shownSpotIdRef.current === approvedId) {
        approveCloseTimerRef.current = setTimeout(() => onClose(), DELAYS.approveClose);
      }
    } catch {
      showToast(t('approveError'), 'error');
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async (reason: string) => {
    await rejectSpot(spot.id, reason);
    showToast(t('spotRejectedToast'), 'success');
  };

  return (
    <div className="rounded-[18px] bg-surface-1 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className={`text-xs px-3 py-1 rounded-full font-medium ${statusClass(spot.status)}`}>
          {t(statusLabelKey(spot.status))}
        </span>
        {spot.status === 'pending' && (
          <div className="flex gap-2">
            <Button variant="destructive" size="sm" onClick={() => setRejecting(true)}>
              <XCircle className="w-4 h-4" aria-hidden="true" />
              {t('reject')}
            </Button>
            <Button size="sm" onClick={handleApprove} disabled={isApproving}>
              <CheckCircle className="w-4 h-4" aria-hidden="true" />
              {isApproving ? t('approving') : t('approve')}
            </Button>
          </div>
        )}
      </div>
      {spot.status === 'rejected' && spot.rejection && (
        <p className="text-[14px] text-label-secondary">{t('rejectionReason', { reason: spot.rejection.reason })}</p>
      )}
      {rejecting && (
        <ReasonSheet title="rejectSpotTitle" confirmLabel="reject" onConfirm={handleReject} onClose={() => setRejecting(false)} />
      )}
    </div>
  );
}

/** Deletes the spot with a reason for its owner (item 4), then closes the panel. */
export function DeleteSpotButton({ spot, onClose }: Readonly<AdminActionProps>) {
  const removeSpot = useModerationStore((s) => s.removeSpot);
  const showToast = useToastStore((s) => s.showToast);
  const t = useT();
  const [asking, setAsking] = useState(false);

  const handleRemove = async (reason: string) => {
    await removeSpot(spot.id, spot.createdBy, reason);
    showToast(t('spotDeleted'), 'success');
    onClose();
  };

  return (
    <>
      <button
        onClick={() => setAsking(true)}
        className="w-full py-3 rounded-xl font-medium text-sm bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 active:scale-98 transition-all flex items-center justify-center gap-2"
      >
        <Trash2 className="w-4 h-4" /> {t('deleteSpot')}
      </button>
      {asking && (
        <ReasonSheet title="removeSpotTitle" confirmLabel="deleteSpot" onConfirm={handleRemove} onClose={() => setAsking(false)} />
      )}
    </>
  );
}
