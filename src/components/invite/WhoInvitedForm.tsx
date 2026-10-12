'use client';

import { useState } from 'react';
import { useT } from '@/hooks/useT';
import { claimErrorKey, useReferralStore } from '@/store/useReferralStore';
import { useToastStore } from '@/store/useToastStore';
import { normalizeInviteCode, REFERRAL_XP } from '@/lib/referral';
import { playSound } from '@/store/useSoundStore';

/** "Who invited you?": the inviter's username or link (prefilled from an opened invite link). */
export default function WhoInvitedForm({ onDone, onSkip }: Readonly<{ onDone: () => void; onSkip?: () => void }>) {
  const t = useT();
  const pending = useReferralStore((s) => s.pendingCode);
  const claim = useReferralStore((s) => s.claim);
  const [value, setValue] = useState(pending ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const code = normalizeInviteCode(value);

  const submit = async () => {
    if (!code || busy) return;
    setBusy(true);
    setError(null);
    try {
      await claim(code);
      playSound('follow');
      useToastStore.getState().showToast(t('inviteClaimed', { name: code, xp: REFERRAL_XP.invitee }), 'success');
      onDone();
    } catch (e) {
      console.error('Claim referral failed:', e);
      setError(t(claimErrorKey(e)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <label className="flex items-center gap-2 h-12 px-4 rounded-xl bg-white/6 focus-within:ring-2 focus-within:ring-brand-400">
        <span className="text-label-tertiary">@</span>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t('whoInvitedPlaceholder')}
          aria-label={t('whoInvitedPlaceholder')}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="flex-1 min-w-0 bg-transparent text-label text-[16px] outline-none placeholder:text-label-tertiary"
        />
      </label>
      {error && <p role="alert" className="text-[13px] text-red-300">{error}</p>}
      <div className="flex gap-2">
        {onSkip && (
          <button type="button" onClick={onSkip} className="flex-1 h-12 rounded-full bg-white/8 text-label font-semibold">
            {t('whoInvitedSkip')}
          </button>
        )}
        <button type="submit" disabled={!code || busy} className="flex-1 h-12 rounded-full bg-brand-600 text-white font-semibold disabled:opacity-40">
          {t('whoInvitedSubmit')}
        </button>
      </div>
    </form>
  );
}
