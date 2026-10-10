'use client';

import { actionErrorKey } from '@/lib/callableErrors';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Loader2 } from 'lucide-react';
import { useT } from '@/hooks/useT';
import { useUserStore } from '@/store/useUserStore';
import { useUiStore } from '@/store/useUiStore';
import { useToastStore } from '@/store/useToastStore';
import { REPORT_REASONS, useSafetyStore, type ReportReason, type ReportTarget } from '@/store/useSafetyStore';
import type { TranslationKey } from '@/lib/translations';
import Button from '../ui/Button';
import ModalShell from '../ui/ModalShell';

const MAX_TEXT = 500;

const REASON_LABEL: Readonly<Record<ReportReason, TranslationKey>> = {
  spam: 'reportReasonSpam',
  offensive: 'reportReasonOffensive',
  wrong_place: 'reportReasonWrongPlace',
  dangerous: 'reportReasonDangerous',
  privacy: 'reportReasonPrivacy',
  other: 'reportReasonOther',
};

/** Reports a spot, photo, review, reply or profile with a reason (admins review it). Signed in only. */
export default function ReportSheet({ target, onClose }: Readonly<{ target: ReportTarget; onClose: () => void }>) {
  const t = useT();
  const signedIn = useUserStore((s) => !!s.user);
  const report = useSafetyStore((s) => s.report);
  const showToast = useToastStore((s) => s.showToast);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  // Signed out: sign in first.
  useEffect(() => {
    if (signedIn) return;
    onClose();
    useUiStore.getState().openAuth();
  }, [signedIn, onClose]);
  if (!signedIn) return null;

  const send = async () => {
    if (!reason || busy) return;
    setBusy(true);
    try {
      await report(target, reason, text);
      showToast(t('reportSent'), 'success');
      onClose();
    } catch (error) {
      console.error('Report failed:', error);
      showToast(t(actionErrorKey(error)), 'error');
      setBusy(false);
    }
  };

  return createPortal(
    <ModalShell variant="slate" z="modal" onBackdropClick={busy ? undefined : onClose} backdropLabel="Close" panelClassName="w-[92%] max-w-md p-5">
      <div role="dialog" aria-modal="true" aria-labelledby="report-title">
        <h3 id="report-title" className="text-label text-[20px] font-bold">{t('reportTitle')}</h3>
        <p className="text-label-secondary text-[14px] mt-1 mb-3">{t('reportHint')}</p>
        <div role="radiogroup" aria-labelledby="report-title" className="rounded-r2 bg-white/6 divide-y divide-white/6 overflow-hidden">
          {REPORT_REASONS.map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={reason === r}
              onClick={() => setReason(r)}
              className="no-min-size w-full flex items-center justify-between px-4 h-12 text-left text-label text-[15px] active:bg-white/6"
            >
              {t(REASON_LABEL[r])}
              {reason === r && <Check className="w-4 h-4 text-brand-400" aria-hidden="true" />}
            </button>
          ))}
        </div>
        <textarea
          aria-label={t('reportDetails')}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={MAX_TEXT}
          rows={3}
          placeholder={t('reportDetails')}
          className="mt-3 w-full rounded-r2 bg-white/6 border border-white/10 focus:border-white/30 focus:outline-hidden px-4 py-3 text-label placeholder-white/35 resize-none"
        />
        <div className="flex gap-2 mt-4">
          <Button variant="gray" size="md" block onClick={onClose} disabled={busy}>{t('cancel')}</Button>
          <Button variant="destructive" size="md" block onClick={send} disabled={!reason || busy}>
            {busy && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
            {t('reportSend')}
          </Button>
        </div>
      </div>
    </ModalShell>,
    document.body,
  );
}
