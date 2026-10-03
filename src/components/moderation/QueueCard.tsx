'use client';

import { useState, type ReactNode } from 'react';
import { CheckCircle, XCircle } from 'lucide-react';
import { useToastStore } from '@/store/useToastStore';
import { useT } from '@/hooks/useT';
import type { TranslationKey } from '@/lib/translations';
import Button from '../ui/Button';
import ReasonSheet from './ReasonSheet';

interface QueueCardProps {
  /** What is reviewed (the spot's name): the card's accessible name. */
  label: string;
  children: ReactNode;
  /** Title of the reason sheet (what is rejected). */
  rejectTitle: TranslationKey;
  onApprove: () => Promise<void>;
  onReject: (reason: string) => Promise<void>;
  approvedToast: TranslationKey;
  rejectedToast: TranslationKey;
}

/** One item of an admin review queue (item 4): its content, then Reject (with a reason) and Approve. */
export default function QueueCard({ label, children, rejectTitle, onApprove, onReject, approvedToast, rejectedToast }: Readonly<QueueCardProps>) {
  const t = useT();
  const showToast = useToastStore((s) => s.showToast);
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  const approve = async () => {
    setBusy(true);
    try {
      await onApprove();
      showToast(t(approvedToast), 'success');
    } catch (error) {
      console.error('Approve failed:', error);
      showToast(t('moderationError'), 'error');
      setBusy(false);
    }
  };

  const reject = async (reason: string) => {
    await onReject(reason);
    showToast(t(rejectedToast), 'success');
  };

  return (
    <section aria-label={label} className="rounded-[18px] bg-surface-1 p-4 space-y-4 motion-safe:animate-item-in">
      {children}
      <div className="flex gap-2">
        <Button variant="destructive" size="md" block onClick={() => setRejecting(true)} disabled={busy}>
          <XCircle className="w-4 h-4" aria-hidden="true" />
          {t('reject')}
        </Button>
        <Button size="md" block onClick={approve} disabled={busy}>
          <CheckCircle className="w-4 h-4" aria-hidden="true" />
          {t('approve')}
        </Button>
      </div>
      {rejecting && <ReasonSheet title={rejectTitle} confirmLabel="reject" onConfirm={reject} onClose={() => setRejecting(false)} />}
    </section>
  );
}
