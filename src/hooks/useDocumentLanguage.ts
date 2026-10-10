import { useEffect } from 'react';
import { useLanguageStore } from '@/store/useLanguageStore';

/** Keeps `<html lang>` on the UI language (screen readers, translation prompts, store checks). */
export function useDocumentLanguage() {
  const language = useLanguageStore((s) => s.language);
  useEffect(() => {
    if (language) document.documentElement.lang = language;
  }, [language]);
}
