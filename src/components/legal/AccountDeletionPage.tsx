'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, CircleCheck, LogIn, UserX } from 'lucide-react';
import AuthModal from '@/components/AuthModal';
import DeleteAccountModal from '@/components/settings/DeleteAccountModal';
import { useInitialLanguage } from '@/hooks/useInitialLanguage';
import { useT } from '@/hooks/useT';
import { deletionConfirmWord } from '@/lib/accountDeletion';
import { useUserStore } from '@/store/useUserStore';

// Build-time public value (A1), shown as the fallback for users who cannot sign in.
const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL;

type Stage = 'loading' | 'signedOut' | 'signedIn' | 'deleted';

function stageOf(deleted: boolean, authReady: boolean, signedIn: boolean): Stage {
  if (deleted) return 'deleted';
  if (!authReady) return 'loading';
  return signedIn ? 'signedIn' : 'signedOut';
}

function Section({ heading, children }: Readonly<{ heading: string; children: ReactNode }>) {
  return (
    <section className="rounded-[18px] bg-surface-1 p-5 space-y-3 motion-safe:animate-item-in">
      <h2 className="text-label text-[17px] font-semibold">{heading}</h2>
      {children}
    </section>
  );
}

const PRIMARY = `no-min-size w-full h-[50px] rounded-full font-semibold text-[17px] flex items-center justify-center gap-2
  active:scale-[.98] transition-transform duration-150`;

/**
 * The public account deletion page Google Play requires (A2): how to delete in the app, and a
 * signed-in flow here that reuses the deleteAccount callable with its typed confirmation.
 */
export default function AccountDeletionPage() {
  useInitialLanguage();
  const t = useT();
  const user = useUserStore((s) => s.user);
  const initAuth = useUserStore((s) => s.initAuth);
  const signOut = useUserStore((s) => s.signOut);
  const [authReady, setAuthReady] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [dialog, setDialog] = useState<'none' | 'signIn' | 'delete'>('none');

  useEffect(() => {
    void initAuth().then(() => setAuthReady(true));
  }, [initAuth]);

  const stage = stageOf(deleted, authReady, user !== null);

  return (
    <div className="fixed inset-0 overflow-y-auto bg-surface-0 text-label-secondary">
      <main className="max-w-xl mx-auto px-5 pb-10 space-y-4" style={{ paddingTop: 'calc(1.5rem + env(safe-area-inset-top))' }}>
        <Link href="/" className="inline-flex items-center gap-2 text-brand-400 text-[15px] font-medium">
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          SpotOn
        </Link>
        <header className="space-y-2 pb-2">
          <h1 className="text-label text-[28px] font-bold tracking-tight leading-tight">{t('accountDeletionTitle')}</h1>
          <p className="text-[15px] leading-relaxed">{t('accountDeletionIntro')}</p>
        </header>

        <Section heading={t('accountDeletionGoesHeading')}>
          <p className="text-[15px] leading-relaxed">{t('deleteAccountBody')}</p>
        </Section>
        <Section heading={t('accountDeletionStaysHeading')}>
          <p className="text-[15px] leading-relaxed">{t('deleteAccountKeeps')}</p>
        </Section>
        <Section heading={t('accountDeletionInAppHeading')}>
          <p className="text-[15px] leading-relaxed">{t('accountDeletionInApp')}</p>
        </Section>

        <Section heading={t('accountDeletionHereHeading')}>
          {stage === 'loading' && <div className="h-[50px] rounded-full bg-surface-2 motion-safe:animate-pulse" />}
          {stage === 'signedOut' && (
            <>
              <p className="text-[15px] leading-relaxed">{t('accountDeletionSignInHint')}</p>
              <button type="button" onClick={() => setDialog('signIn')} className={`${PRIMARY} bg-brand-600 text-white`}>
                <LogIn className="w-5 h-5" aria-hidden="true" />
                {t('signIn')}
              </button>
            </>
          )}
          {stage === 'signedIn' && user && (
            <>
              <p className="text-[15px] text-label">{t('accountDeletionSignedInAs', { name: user.username || user.email })}</p>
              <button type="button" onClick={() => setDialog('delete')} className={`${PRIMARY} bg-red-600 text-white`}>
                <UserX className="w-5 h-5" aria-hidden="true" />
                {t('deleteAccount')}
              </button>
              <button type="button" onClick={() => void signOut()} className="no-min-size w-full py-2 text-[15px] text-brand-400">
                {t('signOut')}
              </button>
            </>
          )}
          {stage === 'deleted' && (
            <p role="status" className="flex items-start gap-2 text-[15px] text-label motion-safe:animate-item-in">
              <CircleCheck className="w-5 h-5 text-brand-400 shrink-0 mt-0.5" aria-hidden="true" />
              {t('accountDeletionDone')}
            </p>
          )}
        </Section>

        {CONTACT_EMAIL && (
          <Section heading={t('accountDeletionNoAccessHeading')}>
            <p className="text-[15px] leading-relaxed">{t('accountDeletionNoAccess', { email: CONTACT_EMAIL })}</p>
          </Section>
        )}
      </main>

      <AuthModal isOpen={dialog === 'signIn'} onClose={() => setDialog('none')} />
      {dialog === 'delete' && user && (
        <DeleteAccountModal
          confirmWord={deletionConfirmWord(user)}
          onClose={() => setDialog('none')}
          onDeleted={() => {
            setDeleted(true);
            setDialog('none');
          }}
        />
      )}
    </div>
  );
}
