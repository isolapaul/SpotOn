'use client';

import { useLanguageStore } from '@/store/useLanguageStore';
import { X } from 'lucide-react';

interface DistanceSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (distance: number) => void;
}

export default function DistanceSelector({ isOpen, onClose, onSelect }: Readonly<DistanceSelectorProps>) {
  const { t, language } = useLanguageStore();

  if (!isOpen) return null;

  const distances = [
    { value: 1, label: t('within1km') },
    { value: 5, label: t('within5km') },
    { value: 10, label: t('within10km') },
    { value: 25, label: t('within25km') },
    { value: 50, label: t('within50km') },
  ];

  const title = language === 'hu' ? 'Hány km körzetben?' : language === 'de' ? 'In welchem Umkreis?' : 'Within what range?';
  const subtitle = language === 'hu' 
    ? 'Válassz távolságot a random helyhez' 
    : language === 'de' 
    ? 'Wählen Sie eine Entfernung für den zufälligen Ort' 
    : 'Choose distance for random spot';

  return (
    <div 
      className="fixed inset-0 z-[2001] flex items-center justify-center p-4 animate-fade-in"
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.5)' }}
    >
      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-xl cursor-default"
        onClick={onClose}
        aria-label="Close"
      />
      
      {/* Modal */}
      <div 
        className="relative glass-card max-w-sm w-full p-6 animate-slide-up"
        style={{
          marginTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)',
          marginBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)'
        }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 glass-button p-3 rounded-full touch-manipulation min-w-[48px] min-h-[48px]"
          aria-label={t('close')}
        >
          <X className="w-5 h-5 text-white" />
        </button>

        {/* Title */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white mb-2">🎲 {title}</h2>
          <p className="text-white/70 text-sm">{subtitle}</p>
        </div>

        {/* Distance Options */}
        <div className="space-y-3">
          {distances.map((distance) => (
            <button
              key={distance.value}
              onClick={() => {
                onSelect(distance.value);
                onClose();
              }}
              className="w-full px-6 py-4 rounded-xl text-left transition-all duration-200
                bg-black/40 border border-white/10 text-white
                hover:bg-black/50 hover:border-white/30 hover:scale-[1.02]
                active:scale-95 backdrop-blur-xl
                flex items-center justify-between group"
            >
              <span className="font-medium">{distance.label}</span>
              <span className="text-white/50 group-hover:text-white/70 transition-colors">→</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
