'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2 } from 'lucide-react';
import { useT } from '@/hooks/useT';
import { MAX_REASON_LENGTH, validReason } from '@/lib/moderation';
import type { TranslationKey } from '@/lib/translations';
import Button from '../ui/Button';
import ModalShell from '../ui/ModalShell';

interface ReasonSheetProps {
  title: TranslationKey;
  /** The destructive action's label (Reject, Delete). */
  confirmLabel: TranslationKey;
  /** Runs the decision with the trimmed reason; a rejection keeps the sheet open (the error shows). */
  onConfirm: (reason: string) => Promise<void>;
  onClose: () => void;
}

/** Asks an admin (in a sheet over everything) for the reason of a rejection or removal (required, 1–500 characters; item 4). */
export default function ReasonSheet({ title, confirmLabel, onConfirm, onClose }: Readonly<ReasonSheetProps>) {
  const t = useT();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const reason = validReason(text);
  // Under the field: a failed attempt, else what is missing.
  let hint = '';
  if (failed) hint = t('moderationError');
  else if (!reason) hint = t('reasonRequired');

  const confirm = async () => {
    if (!reason || busy) return;
    setBusy(true);
    setFailed(false);
    try {
      await onConfirm(reason);
      onClose();
    } catch (error) {
      console.error('Moderation action failed:', error);
      setFailed(true);
      setBusy(false);
    }
  };

  // Portalled to the body: it opens from cards inside scrolling, transformed sheets (the profile, the
  // spot details), where a fixed overlay would be clipped to that sheet.
  return createPortal(
    <ModalShell
      variant="slate"
      z="modal"
      onBackdropClick={busy ? undefined : onClose}
      backdropLabel="Close"
      panelClassName="w-[92%] max-w-md p-5"
    >
      <div role="dialog" aria-modal="true" aria-labelledby="moderation-reason-title">
        <h3 id="moderation-reason-title" className="text-label text-[20px] font-bold mb-3">{t(title)}</h3>
        <label htmlFor="moderation-reason" className="block text-label-secondary text-[14px] mb-2">
          {t('reasonLabel')}
        </label>
        <textarea
          id="moderation-reason"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={MAX_REASON_LENGTH}
          rows={4}
          autoFocus
          disabled={busy}
          placeholder={t('reasonPlaceholder')}
          className="w-full rounded-r2 bg-white/6 border border-white/10 focus:border-white/30 focus:outline-hidden
            px-4 py-3 text-label placeholder-white/35 resize-none"
        />
        <div className="flex justify-between mt-1.5 text-[12px]">
          <span className={failed ? 'text-[#FF6961]' : 'text-label-tertiary'}>{hint}</span>
          <span className="text-label-tertiary tabular-nums">{text.length}/{MAX_REASON_LENGTH}</span>
        </div>
        <div className="flex gap-2 mt-4">
          <Button variant="gray" size="md" block onClick={onClose} disabled={busy}>{t('cancel')}</Button>
          <Button variant="destructive" size="md" block onClick={confirm} disabled={!reason || busy}>
            {busy && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
            {t(confirmLabel)}
          </Button>
        </div>
      </div>
    </ModalShell>,
    document.body,
  );
}
