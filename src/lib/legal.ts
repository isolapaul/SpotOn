// Fills the legal documents' {controller} / {email} placeholders (A1). Pure.

/** Shown when the build has no value, so a missing variable is visible instead of silent. */
export const LEGAL_MISSING = '[nincs megadva]';

/** The legal page for a UI language: Hungarian, else the English translation (German UI too, item 9). */
export function legalHref(doc: 'privacy' | 'terms', language: string): string {
  return language === 'hu' ? `/${doc}` : `/${doc}/en`;
}

export function fillLegalText(text: string, values: { controller?: string; email?: string }): string {
  return text
    .replaceAll('{controller}', values.controller?.trim() || LEGAL_MISSING)
    .replaceAll('{email}', values.email?.trim() || LEGAL_MISSING);
}
