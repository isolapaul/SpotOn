import { useCallback } from 'react';
import { useLanguageStore } from '@/store/useLanguageStore';
import { translate, type Language, type TranslationVars } from '@/lib/i18n';
import type { TranslationKey } from '@/lib/translations';

interface LanguageOptions {
  /** Language used while none has been chosen yet (`language === null`). Default `'hu'`. */
  fallback?: Language;
}

/** Current UI language (the fallback while none is chosen). Re-renders on language change. */
export function useLanguage(opts?: LanguageOptions): Language {
  const language = useLanguageStore((s) => s.language);
  return language ?? opts?.fallback ?? 'hu';
}

/**
 * The translation function for the current language: `t(key, vars?)`.
 * Subscribes to the language, so components re-render on a switch; the function is stable per language.
 */
export function useT(opts?: LanguageOptions) {
  const lang = useLanguage(opts);
  return useCallback(
    (key: TranslationKey, vars?: TranslationVars) => translate(lang, key, vars),
    [lang],
  );
}
