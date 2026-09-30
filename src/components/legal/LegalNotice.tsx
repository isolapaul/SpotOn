'use client';

import { Fragment } from 'react';
import { useLanguage, useT } from '@/hooks/useT';
import { legalHref } from '@/lib/legal';
import { splitSlots } from '@/lib/i18n';
import type { TranslationKey } from '@/lib/translations';

/**
 * The acceptance sentence (A1) with its {terms} and {privacy} placeholders as links. The documents
 * open in a new tab, so the sign-in sheet or the prompt keeps its state.
 */
export default function LegalNotice({ textKey, className }: Readonly<{ textKey: TranslationKey; className: string }>) {
  const t = useT();
  const language = useLanguage();
  const links = {
    terms: { href: legalHref('terms', language), label: t('authTermsLink') },
    privacy: { href: legalHref('privacy', language), label: t('authPrivacyLink') },
  } as const;

  return (
    <p className={className}>
      {splitSlots(t(textKey)).map((part, i) => {
        if ('text' in part) return <Fragment key={i}>{part.text}</Fragment>;
        const link = links[part.slot as keyof typeof links];
        if (!link) return null;
        return (
          <a key={i} href={link.href} target="_blank" rel="noopener" className="underline underline-offset-2 text-white/80 hover:text-white">
            {link.label}
          </a>
        );
      })}
    </p>
  );
}
