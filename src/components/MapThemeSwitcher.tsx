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
        className={`fixed z-[1500] p-4 rounded-full 
          active:scale-95 transition-all duration-200 shadow-glass-lg
          touch-manipulation select-none min-w-[56px] min-h-[56px] ${
            isOpen 
              ? 'bg-purple-600 border-2 border-purple-400' 
              : 'bg-slate-800/90 backdrop-blur-xl border-2 border-white/20 hover:bg-slate-700/90'
          }`}
        style={{
          top: 'calc(1rem + env(safe-area-inset-top))',
          right: 'max(1rem, env(safe-area-inset-right))'
        }}
        aria-label="Map Theme"
      >
        <Palette className="w-6 h-6 text-white" strokeWidth={2} />
      </button>

      {/* Theme Selector Panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <button
            type="button"
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1400] animate-fade-in touch-manipulation"
            onClick={() => setIsOpen(false)}
            aria-label="Close theme selector"
          />
          
          {/* Panel */}
          <div className="fixed top-20 right-4 z-[1500] glass-card w-72
            animate-slide-down safe-area">
            
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <Palette className="w-5 h-5 text-white" strokeWidth={2} />
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
            <div className="p-4 grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto custom-scrollbar">
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
        </>
      )}
    </>
  );
}
