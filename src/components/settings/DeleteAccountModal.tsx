'use client';

import { useState } from 'react';
import { Loader2, TriangleAlert } from 'lucide-react';
import { useUserStore } from '@/store/useUserStore';
import { useToastStore } from '@/store/useToastStore';
import { useNotificationStore } from '@/store/useNotificationStore';
import { useT } from '@/hooks/useT';
import { deleteAccountErrorKey } from '@/lib/accountDeletion';
import { translate } from '@/lib/i18n';
import { useLanguageStore } from '@/store/useLanguageStore';
import { useUploadStore } from '@/store/useUploadStore';
import ModalShell from '../ui/ModalShell';

interface DeleteAccountModalProps {
  confirmWord: string;
  onClose: () => void;
  /** Called after the account is gone (the user is signed out by then). */
  onDeleted?: () => void;
}

/** Permanent account deletion (A2): what goes, what stays, typed username confirmation. */
export default function DeleteAccountModal({ confirmWord, onClose, onDeleted }: Readonly<DeleteAccountModalProps>) {
  const deleteAccount = useUserStore((s) => s.deleteAccount);
  const showToast = useToastStore((s) => s.showToast);
  const t = useT();
  const [typed, setTyped] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const matches = typed.trim().toLowerCase() === confirmWord.toLowerCase();
  // A background upload finishing after the server's cleanup would leave data behind (A2 review).
  const uploadsPending = useUploadStore((s) => s.jobs.some((j) => j.status !== 'done'));

  const handleDelete = async () => {
    if (!matches || isDeleting || uploadsPending) return;
    setIsDeleting(true);
    setError(null);
    try {
      await deleteAccount(typed.trim());
      // The local history belonged to the deleted account.
      useNotificationStore.getState().clearAll();
      showToast(translate(useLanguageStore.getState().language ?? 'hu', 'accountDeleted'), 'success');
      onDeleted?.();
    } catch (err) {
      console.error('Account deletion failed:', err);
      setError(t(deleteAccountErrorKey(err)));
      setIsDeleting(false);
    }
  };

  return (
    <ModalShell
      variant="slate"
      z="modal"
      onBackdropClick={isDeleting ? undefined : onClose}
      backdropLabel="Close"
      panelClassName="w-[90%] max-w-md p-6"
    >
      <div className="flex items-start gap-3 mb-4">
        <div className="flex-shrink-0 w-11 h-11 rounded-full bg-red-500/15 flex items-center justify-center">
          <TriangleAlert className="w-5 h-5 text-red-400" strokeWidth={2.2} />
        </div>
        <h3 className="text-white text-lg font-semibold leading-snug pt-2">{t('deleteAccountTitle')}</h3>
      </div>
      <p className="text-white/70 text-sm leading-relaxed mb-2">{t('deleteAccountBody')}</p>
      <p className="text-white/70 text-sm leading-relaxed mb-5">{t('deleteAccountKeeps')}</p>

      <label htmlFor="delete-account-confirm" className="block text-white/80 text-sm mb-2">
        {t('deleteAccountConfirm', { username: confirmWord })}
      </label>
      <input
        id="delete-account-confirm"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        disabled={isDeleting}
        className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-red-500"
      />
      {uploadsPending && <p className="text-amber-300 text-sm mt-3">{t('deleteAccountUploadsPending')}</p>}
      {error && <p className="text-red-300 text-sm mt-3">{error}</p>}

      <div className="flex gap-2 mt-5">
        <button
          onClick={onClose}
          disabled={isDeleting}
          className="flex-1 py-3 rounded-xl bg-white/10 text-white/80 font-medium hover:bg-white/15 active:scale-[0.97] transition disabled:opacity-50"
        >
          {t('cancel')}
        </button>
        <button
          onClick={handleDelete}
          disabled={!matches || isDeleting || uploadsPending}
          className="flex-1 py-3 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-500 active:scale-[0.97] transition disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {isDeleting && <Loader2 className="w-4 h-4 animate-spin" />}
          {isDeleting ? t('deleteAccountRunning') : t('deleteAccountButton')}
        </button>
      </div>
    </ModalShell>
  );
}
