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
    { id: 'light', name: t('themeLight'), preview: 'bg-gradient-to-br from-gray-50 to-blue-50' },
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
      {/* Theme Switcher Button - Top Right Corner - PHASE 3 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed z-[1500] w-12 h-12 rounded-full 
          bg-black/40 backdrop-blur-md border border-white/10
          active:scale-95 transition-all duration-200 shadow-glass-lg
          hover:bg-black/50
          touch-manipulation select-none flex items-center justify-center"
        style={{
          top: 'calc(1rem + env(safe-area-inset-top))',
          right: 'max(1rem, env(safe-area-inset-right))'
        }}
        aria-label="Map Theme"
      >
        <Palette className="w-6 h-6 text-white" strokeWidth={2} />
      </button>

      {/* Theme Selector Modal - Centered */}
      {isOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 animate-fade-in">
          {/* Backdrop - Click to close */}
          <button
            type="button"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm touch-manipulation"
            onClick={() => setIsOpen(false)}
            aria-label="Close theme selector"
          />
          
          {/* Modal Content */}
          <div className="relative bg-[#0f172a]/90 backdrop-blur-xl w-[80%] max-w-sm rounded-3xl 
            border border-white/10 overflow-hidden animate-scale-in
            max-h-[80vh] flex flex-col">
            
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/10 bg-slate-800/50">
              <div className="flex items-center gap-3">
                <Palette className="w-6 h-6 text-white" strokeWidth={2} />
                <h3 className="text-white font-semibold text-lg">
                  {t('mapTheme')}
                </h3>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 -m-2 rounded-full hover:bg-white/10 transition-colors touch-manipulation min-w-[48px] min-h-[48px] flex items-center justify-center"
                aria-label="Close"
              >
                <span className="text-white/70 text-2xl leading-none">×</span>
              </button>
            </div>

            {/* Theme Grid */}
            <div className="p-6 grid grid-cols-2 gap-3 overflow-y-auto custom-scrollbar">
              {themes.map((themeOption) => (
                <button
                  key={themeOption.id}
                  onClick={() => handleThemeSelect(themeOption.id)}
                  className={`
                    relative p-4 rounded-2xl border-2 transition-all duration-200
                    flex flex-col items-center gap-2
                    active:scale-95 touch-manipulation
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
        </div>
      )}
    </>
  );
}
