import { translations, type TranslationKey } from './translations';

/** UI languages. `null` in the language store means "not chosen yet" (first visit). */
export type Language = 'hu' | 'en' | 'de';

export type TranslationVars = Record<string, string | number>;

/**
 * Replaces the first `{name}` of each var with its value (same as the former `.replace('{name}', v)`).
 * Placeholders without a var stay as they are.
 */
export function interpolate(s: string, vars?: TranslationVars): string {
  if (!vars) return s;
  let out = s;
  for (const [name, value] of Object.entries(vars)) {
    // Replacer function: the value is inserted literally (no `$&`-style patterns).
    out = out.replace(`{${name}}`, () => String(value));
  }
  return out;
}

/** Translated text for `key` in `lang`, with vars applied; the key itself when the text is missing. */
export function translate(lang: Language, key: TranslationKey, vars?: TranslationVars): string {
  const text: string | undefined = translations[lang]?.[key];
  return interpolate(text || key, vars);
}

/** Splits `**bold**` markers into segments, so rich text renders as `<strong>` without innerHTML. */
export function splitBold(s: string): Array<{ text: string; bold: boolean }> {
  return s
    .split('**')
    .map((text, i) => ({ text, bold: i % 2 === 1 }))
    .filter((part) => part.text !== '');
}
