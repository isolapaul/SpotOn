import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { hasDictionary, registerDictionary, type Language } from '@/lib/i18n';

// Moved to lib/i18n (T24); re-exported for existing imports.
export type { Language };

// Translate with `useT()` (React) or `translate()` from lib/i18n (non-React code).
interface LanguageStore {
  language: Language | null;
  setLanguage: (lang: Language) => void;
  hasSelectedLanguage: boolean;
  /** Bumped when a dictionary arrives, so useT re-renders with the real texts. Not persisted. */
  dictionaries: number;
}

/** The English and German texts are separate chunks (lib/translations). */
const LOADERS: Partial<Record<Language, () => Promise<{ default: Parameters<typeof registerDictionary>[1] }>>> = {
  en: () => import('@/lib/dictionaries/en'),
  de: () => import('@/lib/dictionaries/de'),
};
const loading = new Map<Language, Promise<void>>();

/**
 * Loads `lang`'s dictionary once (Hungarian is always there); resolves when its texts are in use.
 * A failed load (offline) is retried on the next call; Hungarian stands in meanwhile.
 */
export function ensureLanguage(lang: Language | null | undefined): Promise<void> {
  if (!lang || hasDictionary(lang)) return Promise.resolve();
  const load = LOADERS[lang];
  if (!load) return Promise.resolve();
  let pending = loading.get(lang);
  if (!pending) {
    pending = load()
      .then((m) => {
        registerDictionary(lang, m.default);
        useLanguageStore.setState((s) => ({ dictionaries: s.dictionaries + 1 }));
      })
      .catch((error: unknown) => {
        console.error(`Dictionary ${lang} failed to load:`, error);
        loading.delete(lang);
      });
    loading.set(lang, pending);
  }
  return pending;
}

export const useLanguageStore = create<LanguageStore>()(
  persist(
    (set) => ({
      language: null,
      hasSelectedLanguage: false,
      dictionaries: 0,
      setLanguage: (lang: Language) => {
        void ensureLanguage(lang);
        set({ language: lang, hasSelectedLanguage: true });
      },
    }),
    {
      name: 'spoton-language',
      partialize: (s) => ({ language: s.language, hasSelectedLanguage: s.hasSelectedLanguage }),
      // The stored language's texts start loading as soon as the choice is known.
      onRehydrateStorage: () => (state) => {
        void ensureLanguage(state?.language);
      },
    }
  )
);
