'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCircle, Trash2 } from 'lucide-react';
import { useSpotStore, type Spot } from '@/store/useSpotStore';
import { useToastStore } from '@/store/useToastStore';
import { useT } from '@/hooks/useT';
import { DELAYS } from '@/lib/constants';

// Admin-only parts of the details panel. UI only: approve/delete are enforced by the rules.
// Two exports because they sit at different DOM positions (status card first, delete button
// after the image manager).

interface AdminActionProps {
  spot: Spot;
  /** Closes the details panel. */
  onClose: () => void;
}

/** Status pill and, for a pending spot, Approve (closes the panel 1 s after a successful approve). */
export function AdminStatusCard({ spot, onClose }: Readonly<AdminActionProps>) {
  const approveSpot = useSpotStore((s) => s.approveSpot);
  const showToast = useToastStore((s) => s.showToast);
  const t = useT();
  const [isApproving, setIsApproving] = useState(false);
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

  return (
    <div className="rounded-[18px] bg-surface-1 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className={`text-xs px-3 py-1 rounded-full font-medium ${spot.status === 'approved' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
          {spot.status === 'approved' ? t('approved') : t('pending')}
        </span>
        {spot.status === 'pending' && (
          <button
            onClick={handleApprove}
            disabled={isApproving}
            className="px-4 py-2 rounded-xl font-medium bg-gradient-to-r from-green-500 to-green-600 text-white text-sm shadow-lg shadow-green-500/20 hover:shadow-xl active:scale-98 transition-all disabled:opacity-50 flex items-center gap-2"
          >
            <CheckCircle className="w-4 h-4" />
            {isApproving ? t('approving') : t('approve')}
          </button>
        )}
      </div>
    </div>
  );
}

/** Deletes the spot after a confirm, then closes the panel. */
export function DeleteSpotButton({ spot, onClose }: Readonly<AdminActionProps>) {
  const deleteSpot = useSpotStore((s) => s.deleteSpot);
  const showToast = useToastStore((s) => s.showToast);
  const t = useT();

  const handleDeleteSpot = async () => {
    if (!confirm(t('confirmDeleteSpot'))) return;
    try {
      await deleteSpot(spot.id);
      showToast(t('spotDeleted'), 'success');
      onClose();
    } catch {
      showToast(t('spotDeleteError'), 'error');
    }
  };

  return (
    <button
      onClick={handleDeleteSpot}
      className="w-full py-3 rounded-xl font-medium text-sm bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 active:scale-98 transition-all flex items-center justify-center gap-2"
    >
      <Trash2 className="w-4 h-4" /> {t('deleteSpot')}
    </button>
  );
}
