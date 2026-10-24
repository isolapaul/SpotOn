// Fills the legal documents' {controller} / {email} placeholders (A1) and links their languages. Pure.

import type { LegalLanguage } from '@/content/legal/types';

export type LegalDoc = 'privacy' | 'terms';

/** Shown when the build has no value, so a missing variable is visible instead of silent. */
export const LEGAL_MISSING = '[nincs megadva]';

const LEGAL_LANGUAGES: readonly LegalLanguage[] = ['hu', 'en', 'de'];

/** Each language's link label, written in that language. */
const LEGAL_LANGUAGE_LABELS: Record<LegalLanguage, string> = { hu: 'Magyar változat', en: 'English', de: 'Deutsch' };

/** The legal page for a UI language: Hungarian (authoritative) at the root, German under /de, else English. */
export function legalHref(doc: LegalDoc, language: string): string {
  if (language === 'hu') return `/${doc}`;
  return language === 'de' ? `/${doc}/de` : `/${doc}/en`;
}

/** The same document in the other languages, for a legal page's language links. */
export function legalAlternates(doc: LegalDoc, current: LegalLanguage): { href: string; label: string; lang: LegalLanguage }[] {
  return LEGAL_LANGUAGES.filter((lang) => lang !== current)
    .map((lang) => ({ href: legalHref(doc, lang), label: LEGAL_LANGUAGE_LABELS[lang], lang }));
}

export function fillLegalText(text: string, values: { controller?: string; email?: string }): string {
  return text
    .replaceAll('{controller}', values.controller?.trim() || LEGAL_MISSING)
    .replaceAll('{email}', values.email?.trim() || LEGAL_MISSING);
}
