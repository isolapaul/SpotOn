import { useLanguageStore } from '@/store/useLanguageStore';
import { translations, TranslationKey } from '@/locales/translations';

export function useTranslation() {
  const { language } = useLanguageStore();
  
  const t = (key: TranslationKey): string => {
    const lang = language || 'en';
    return translations[lang][key];
  };

  return { t, language };
}
