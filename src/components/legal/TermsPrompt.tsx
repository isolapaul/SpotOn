'use client';

import { useState } from 'react';
import { FileText } from 'lucide-react';
import { useUserStore } from '@/store/useUserStore';
import { useToastStore } from '@/store/useToastStore';
import { useT } from '@/hooks/useT';
import { needsTermsAcceptance } from '@/lib/terms';
import ModalShell from '../ui/ModalShell';
import Button from '../ui/Button';
import LegalNotice from './LegalNotice';

/**
 * One-time acceptance for users who signed up before the terms existed, or before a new version
 * (A1). New users accept by signing up (AuthModal). The only ways out are accepting or signing out.
 */
export default function TermsPrompt({ ready }: Readonly<{ ready: boolean }>) {
  const user = useUserStore((s) => s.user);
  const loading = useUserStore((s) => s.loading);
  const needsUsername = useUserStore((s) => s.needsUsername);
  const acceptTerms = useUserStore((s) => s.acceptTerms);
  const signOut = useUserStore((s) => s.signOut);
  const showToast = useToastStore((s) => s.showToast);
  const t = useT();
  const [busy, setBusy] = useState(false);

  // `loading`: a persisted user from before this version is shown until the fresh doc arrives.
  if (!ready || loading || !user || needsUsername || !needsTermsAcceptance(user.termsVersion)) return null;

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      console.error('Terms prompt action failed:', error);
      showToast(t('genericError'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell variant="glass" z="usernameSetup" panelClassName="max-w-md w-full p-7">
      <div role="dialog" aria-modal="true" aria-labelledby="terms-prompt-title">
        <div className="flex justify-center mb-5">
          <div className="w-[64px] h-[64px] rounded-r3 grid place-items-center bg-brand-500/15">
            <FileText className="w-8 h-8 text-brand-400" strokeWidth={1.75} />
          </div>
        </div>
        <h2 id="terms-prompt-title" className="text-2xl font-bold text-white text-center mb-2">
          {t('termsPromptTitle')}
        </h2>
        <p className="text-white/70 text-center mb-4">{t('termsPromptBody')}</p>
        <LegalNotice textKey="termsPromptNotice" className="text-white/50 text-xs text-center mb-6" />
        <div className="space-y-2">
          <Button block disabled={busy} onClick={() => run(acceptTerms)}>
            {t('termsPromptAccept')}
          </Button>
          <Button block variant="gray" disabled={busy} onClick={() => run(signOut)}>
            {t('signOut')}
          </Button>
        </div>
      </div>
    </ModalShell>
  );
}
