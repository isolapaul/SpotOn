'use client';

import { useLanguageStore } from '@/store/useLanguageStore';
import { translate, type Language } from '@/lib/i18n';
import { Globe, Check } from 'lucide-react';
import { useState, useEffect } from 'react';
import { DELAYS } from '@/lib/constants';

export default function LanguageSelector() {
  const { setLanguage, hasSelectedLanguage } = useLanguageStore();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedLang, setSelectedLang] = useState<'en' | 'hu' | 'de' | null>(null);

  useEffect(() => {
    // Show language selector if user hasn't selected a language yet
    if (!hasSelectedLanguage) {
      // Small delay for smooth entrance
      const id = setTimeout(() => setIsOpen(true), DELAYS.languageSelector);
      return () => clearTimeout(id);
    }
  }, [hasSelectedLanguage]);

  const handleLanguageSelect = (lang: 'en' | 'hu' | 'de') => {
    setSelectedLang(lang);
  };

  const handleContinue = () => {
    if (selectedLang) {
      setLanguage(selectedLang);
      setIsOpen(false);
    }
  };

  if (!isOpen || hasSelectedLanguage) {
    return null;
  }

  // Follows the language tapped in this dialog (not the store), English until one is tapped.
  const lang: Language = selectedLang ?? 'en';

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 animate-fade-in">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />
      
      {/* Modal */}
      <div className="relative glass-card max-w-md w-full p-8 animate-slide-up">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="glass-button p-4 rounded-full">
            <Globe className="w-12 h-12 text-white" strokeWidth={1.5} />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-white text-center mb-2">
          {translate(lang, 'langSelectTitle')}
        </h2>
        <p className="text-white/70 text-center mb-8">
          {translate(lang, 'langSelectDesc')}
        </p>

        {/* Language Options */}
        <div className="space-y-3 mb-8">
          {/* English */}
          <button
            onClick={() => handleLanguageSelect('en')}
            className={`
              w-full p-4 rounded-2xl border-2 transition-all duration-200
              flex items-center justify-between
              active:scale-98
              ${selectedLang === 'en'
                ? 'bg-white/20 border-white/40 backdrop-blur-xl shadow-glass-lg'
                : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
              }
            `}
          >
            <div className="flex items-center gap-4">
              <div className="text-3xl">🇬🇧</div>
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <p className="text-white font-semibold text-lg">English</p>
                  <span className="text-white/60 text-sm font-medium">(EN)</span>
                </div>
                <p className="text-white/60 text-sm">International</p>
              </div>
            </div>
            {selectedLang === 'en' && (
              <div className="bg-primary-500 rounded-full p-1">
                <Check className="w-5 h-5 text-white" strokeWidth={3} />
              </div>
            )}
          </button>

          {/* Hungarian */}
          <button
            onClick={() => handleLanguageSelect('hu')}
            className={`
              w-full p-4 rounded-2xl border-2 transition-all duration-200
              flex items-center justify-between
              active:scale-98
              ${selectedLang === 'hu'
                ? 'bg-white/20 border-white/40 backdrop-blur-xl shadow-glass-lg'
                : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
              }
            `}
          >
            <div className="flex items-center gap-4">
              <div className="text-3xl">🇭🇺</div>
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <p className="text-white font-semibold text-lg">Magyar</p>
                  <span className="text-white/60 text-sm font-medium">(HU)</span>
                </div>
                <p className="text-white/60 text-sm">Magyarország</p>
              </div>
            </div>
            {selectedLang === 'hu' && (
              <div className="bg-primary-500 rounded-full p-1">
                <Check className="w-5 h-5 text-white" strokeWidth={3} />
              </div>
            )}
          </button>

          {/* German */}
          <button
            onClick={() => handleLanguageSelect('de')}
            className={`
              w-full p-4 rounded-2xl border-2 transition-all duration-200
              flex items-center justify-between
              active:scale-98
              ${selectedLang === 'de'
                ? 'bg-white/20 border-white/40 backdrop-blur-xl shadow-glass-lg'
                : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
              }
            `}
          >
            <div className="flex items-center gap-4">
              <div className="text-3xl">🇩🇪</div>
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <p className="text-white font-semibold text-lg">Deutsch</p>
                  <span className="text-white/60 text-sm font-medium">(DE)</span>
                </div>
                <p className="text-white/60 text-sm">Deutschland</p>
              </div>
            </div>
            {selectedLang === 'de' && (
              <div className="bg-primary-500 rounded-full p-1">
                <Check className="w-5 h-5 text-white" strokeWidth={3} />
              </div>
            )}
          </button>
        </div>

        {/* Continue Button */}
        <button
          onClick={handleContinue}
          disabled={!selectedLang}
          className={`
            w-full py-4 rounded-2xl font-semibold text-lg
            transition-all duration-200
            ${selectedLang
              ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg shadow-primary-500/30 hover:shadow-xl hover:shadow-primary-500/40 active:scale-98'
              : 'bg-white/10 text-white/40 cursor-not-allowed'
            }
          `}
        >
          {translate(lang, 'langSelectContinue')}
        </button>
      </div>
    </div>
  );
}
