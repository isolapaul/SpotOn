import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Language } from '@/lib/i18n';

// Moved to lib/i18n (T24); re-exported for existing imports.
export type { Language };

// Translate with `useT()` (React) or `translate()` from lib/i18n (non-React code).
interface LanguageStore {
  language: Language | null;
  setLanguage: (lang: Language) => void;
  hasSelectedLanguage: boolean;
}

export const useLanguageStore = create<LanguageStore>()(
  persist(
    (set) => ({
      language: null,
      hasSelectedLanguage: false,
      setLanguage: (lang: Language) => set({ language: lang, hasSelectedLanguage: true }),
    }),
    {
      name: 'spoton-language',
    }
  )
);
