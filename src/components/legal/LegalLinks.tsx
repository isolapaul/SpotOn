'use client';

import { useLanguage, useT } from '@/hooks/useT';
import { legalHref } from '@/lib/legal';

/** Quiet links to the Privacy Policy and the Terms, reachable without signing in (store review). */
export default function LegalLinks({ className = '' }: Readonly<{ className?: string }>) {
  const t = useT();
  const language = useLanguage();
  const link = 'no-min-size underline-offset-2 hover:underline active:text-label-secondary';
  return (
    <nav aria-label={t('legalLinks')} className={`flex justify-center gap-4 text-[13px] text-label-tertiary ${className}`}>
      <a href={legalHref('privacy', language)} target="_blank" rel="noopener" className={link}>{t('authPrivacyLink')}</a>
      <a href={legalHref('terms', language)} target="_blank" rel="noopener" className={link}>{t('authTermsLink')}</a>
    </nav>
  );
}
