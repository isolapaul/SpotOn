'use client';

import { Globe, Check } from 'lucide-react';
import { useT } from '@/hooks/useT';
import { useLanguageStore } from '@/store/useLanguageStore';
import { useToastStore } from '@/store/useToastStore';
import { LANGUAGE_NAMES, translate, type Language } from '@/lib/i18n';

/** Settings › the interface language; each language in its own name (no flag emoji, owner decision). */
export default function LanguageSection() {
  const { language, setLanguage } = useLanguageStore();
  const t = useT();
  const { showToast } = useToastStore();

  const handleLanguageChange = (newLanguage: string) => {
    setLanguage(newLanguage as Language);
    let langName = 'Magyar';
    if (newLanguage === 'en') langName = 'English';
    else if (newLanguage === 'de') langName = 'Deutsch';
    // Toast in the newly chosen language (the render-time t still has the old one).
    showToast(translate(newLanguage as Language, 'languageChanged', { language: langName }), 'success');
  };

  return (
    <div className="rounded-[18px] bg-surface-1 p-5">
      <h3 className="text-[13px] font-semibold uppercase tracking-wide text-label-tertiary mb-3 flex items-center gap-2">
        <Globe className="w-5 h-5" />
        {t('languageSelection')}
      </h3>
      
      <div className="flex flex-col gap-2">
        {['hu', 'en', 'de'].map((lang) => (
          <button
            key={lang}
            onClick={() => handleLanguageChange(lang)}
            className={`no-min-size w-full text-left py-3 px-4 rounded-xl font-medium transition-all duration-200 ${
              language === lang
                ? 'bg-white/8 text-label'
                : 'bg-transparent text-label-secondary active:bg-white/6'
            }`}
          >
            <span className="flex items-center justify-between">
              <span>{LANGUAGE_NAMES[lang as 'hu' | 'en' | 'de']}</span>
              {language === lang && <Check className="w-5 h-5 text-brand-400" strokeWidth={2.5} aria-hidden="true" />}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
