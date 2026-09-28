import { useEffect } from 'react';
import { useLanguageStore } from '@/store/useLanguageStore';
import { detectLanguage } from '@/lib/i18n';

/**
 * First visit: picks the UI language from the browser (detectLanguage) instead of asking in a
 * dialog. Runs after mount (no hydration mismatch); a stored choice is never overridden, and
 * Settings changes it later.
 */
export function useInitialLanguage() {
  useEffect(() => {
    const { hasSelectedLanguage, setLanguage } = useLanguageStore.getState();
    if (!hasSelectedLanguage) setLanguage(detectLanguage(globalThis.navigator?.languages));
  }, []);
}
