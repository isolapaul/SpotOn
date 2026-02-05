import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { translations, TranslationKey } from '@/lib/translations';

type Language = 'en' | 'hu' | 'de';

interface LanguageStore {
  language: Language | null;
  setLanguage: (lang: Language) => void;
  hasSelectedLanguage: boolean;
  t: (key: TranslationKey) => string;
}

export const useLanguageStore = create<LanguageStore>()(
  persist(
    (set, get) => ({
      language: null,
      hasSelectedLanguage: false,
      setLanguage: (lang: Language) => set({ language: lang, hasSelectedLanguage: true }),
      t: (key: TranslationKey) => {
        const lang = get().language || 'hu';
        return translations[lang][key] || key;
      },
    }),
    {
      name: 'spoton-language',
    }
  )
);
