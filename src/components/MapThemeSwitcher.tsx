'use client';

import { useState } from 'react';
import { Palette, Check } from 'lucide-react';
import { useMapThemeStore, type MapTheme } from '@/store/useMapThemeStore';
import { useLanguageStore } from '@/store/useLanguageStore';

export default function MapThemeSwitcher() {
  const [isOpen, setIsOpen] = useState(false);
  const { theme, setTheme } = useMapThemeStore();
  const { t } = useLanguageStore();

  const themes: { id: MapTheme; name: string; preview: string }[] = [
    { id: 'standard', name: t('themeStandard'), preview: 'bg-gradient-to-br from-blue-100 to-green-100' },
    { id: 'dark', name: t('themeDark'), preview: 'bg-gradient-to-br from-gray-800 to-gray-900' },
    { id: 'night', name: t('themeNight'), preview: 'bg-gradient-to-br from-black to-gray-900' },
    { id: 'silver', name: t('themeSilver'), preview: 'bg-gradient-to-br from-gray-200 to-gray-400' },
    { id: 'retro', name: t('themeRetro'), preview: 'bg-gradient-to-br from-amber-100 to-orange-200' },
    { id: 'purple', name: t('themePurple'), preview: 'bg-gradient-to-br from-purple-900 to-blue-900' },
  ];

  const handleThemeSelect = (themeId: MapTheme) => {
    setTheme(themeId);
    setIsOpen(false);
  };

  return (
    <>
      {/* Theme Switcher Button - Bottom Right */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-24 right-4 z-[1500] p-3 rounded-full 
          active:scale-95 transition-all duration-200 shadow-glass-lg
          safe-bottom ${
            isOpen 
              ? 'bg-purple-600 border-2 border-purple-400' 
              : 'bg-slate-800/90 backdrop-blur-xl border-2 border-white/20 hover:bg-slate-700/90'
          }`}
        aria-label="Map Theme"
      >
        <Palette className="w-5 h-5 text-white" strokeWidth={2} />
      </button>

      {/* Theme Selector Panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            role="button"
            tabIndex={0}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1400] animate-fade-in"
            onClick={() => setIsOpen(false)}
            onKeyDown={(e) => e.key === 'Escape' && setIsOpen(false)}
          />
          
          {/* Panel */}
          <div className="fixed bottom-40 right-4 z-[1500] glass-card w-72
            animate-slide-up safe-bottom">
            
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <Palette className="w-5 h-5 text-white" strokeWidth={2} />
                <h3 className="text-white font-semibold text-lg">
                  {t('mapTheme')}
                </h3>
              </div>
            </div>

            {/* Theme Grid */}
            <div className="p-4 grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto custom-scrollbar">
              {themes.map((themeOption) => (
                <button
                  key={themeOption.id}
                  onClick={() => handleThemeSelect(themeOption.id)}
                  className={`
                    relative p-4 rounded-2xl border-2 transition-all duration-200
                    flex flex-col items-center gap-2
                    active:scale-95
                    ${theme === themeOption.id
                      ? 'bg-white/20 border-white/40 shadow-glass-lg'
                      : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                    }
                  `}
                >
                  {/* Theme Preview */}
                  <div className={`w-full h-16 rounded-xl ${themeOption.preview} 
                    border border-white/20 shadow-inner`} />
                  
                  {/* Theme Name */}
                  <span className="text-white text-sm font-medium text-center">
                    {themeOption.name}
                  </span>
                  
                  {/* Selected Checkmark */}
                  {theme === themeOption.id && (
                    <div className="absolute top-2 right-2 bg-green-500 rounded-full p-1">
                      <Check className="w-3 h-3 text-white" strokeWidth={3} />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}
