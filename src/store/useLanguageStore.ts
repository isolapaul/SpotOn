import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Language = 'en' | 'hu';

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
