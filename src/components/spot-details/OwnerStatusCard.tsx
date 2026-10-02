'use client';

import { useState } from 'react';
import { Clock, RotateCcw, XCircle } from 'lucide-react';
import type { Spot } from '@/store/useSpotStore';
import { useModerationStore } from '@/store/useModerationStore';
import { useToastStore } from '@/store/useToastStore';
import { useT } from '@/hooks/useT';
import Button from '../ui/Button';

interface OwnerStatusCardProps {
  spot: Spot;
  /** Starts editing (the rejected spot's Edit button). */
  onEdit: () => void;
}

const CARD = 'rounded-[18px] bg-surface-1 p-4 space-y-3 motion-safe:animate-item-in';

/**
 * What the owner needs to know about their spot's review (item 4): a rejection with its reason plus
 * Edit and Resubmit, "under review" for a pending spot, and the state of a proposed edit of an
 * approved spot (waiting: Withdraw; rejected with a reason: OK).
 */
export default function OwnerStatusCard({ spot, onEdit }: Readonly<OwnerStatusCardProps>) {
  const t = useT();
  const edit = useModerationStore((s) => s.ownEdits[spot.id]);
  const resubmitSpot = useModerationStore((s) => s.resubmitSpot);
  const dropEdit = useModerationStore((s) => s.dropEdit);
  const showToast = useToastStore((s) => s.showToast);
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<void>, doneKey?: 'resubmitted') => {
    setBusy(true);
    try {
      await action();
      if (doneKey) showToast(t(doneKey), 'success');
    } catch {
      showToast(t('updateError'), 'error');
    } finally {
      setBusy(false);
    }
  };

  if (spot.status === 'rejected') {
    return (
      <div className={`${CARD} ring-1 ring-[#FF453A]/25`}>
        <p className="flex items-center gap-2 text-[17px] font-semibold text-label">
          <XCircle className="w-5 h-5 text-[#FF6961]" aria-hidden="true" />
          {t('ownerRejectedTitle')}
        </p>
        {spot.rejection && <p className="text-[15px] text-label">{t('rejectionReason', { reason: spot.rejection.reason })}</p>}
        <p className="text-[14px] text-label-secondary">{t('ownerRejectedHint')}</p>
        <div className="flex flex-col gap-2">
          <Button size="md" block onClick={() => run(() => resubmitSpot(spot.id), 'resubmitted')} disabled={busy}>
            <RotateCcw className="w-4 h-4" aria-hidden="true" />
            {t('resubmit')}
          </Button>
          <Button variant="gray" size="md" block onClick={onEdit} disabled={busy}>{t('editSpot')}</Button>
        </div>
      </div>
    );
  }

  if (spot.status === 'pending') {
    return (
      <p className={`${CARD} flex items-center gap-2 text-[15px] text-label-secondary`}>
        <Clock className="w-4 h-4 text-amber-300 shrink-0" aria-hidden="true" />
        {t('underReviewNote')}
      </p>
    );
  }

  if (!edit) return null;
  const waiting = edit.status === 'pending';
  return (
    <div className={`${CARD} flex items-center gap-3`}>
      <p className="flex-1 text-[15px] text-label-secondary">
        {waiting ? t('editPendingNote') : t('editRejectedNote', { reason: edit.reason ?? '' })}
      </p>
      <Button variant={waiting ? 'gray' : 'tinted'} size="sm" onClick={() => run(() => dropEdit(spot.id))} disabled={busy}>
        {waiting ? t('withdrawEdit') : t('dismissNote')}
      </Button>
    </div>
  );
}
