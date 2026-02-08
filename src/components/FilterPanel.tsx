'use client';

import { useLanguageStore } from '@/store/useLanguageStore';
import { SlidersHorizontal, X } from 'lucide-react';

interface FilterPanelProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDistance: number | null;
  selectedCategory: string | null;
  onDistanceChange: (distance: number | null) => void;
  onCategoryChange: (category: string | null) => void;
  onClearFilters: () => void;
}

export default function FilterPanel({
  isOpen,
  onClose,
  selectedDistance,
  selectedCategory,
  onDistanceChange,
  onCategoryChange,
  onClearFilters,
}: Readonly<FilterPanelProps>) {
  const { t } = useLanguageStore();

  const distances = [
    { value: 1, label: t('within1km') },
    { value: 5, label: t('within5km') },
    { value: 10, label: t('within10km') },
    { value: 25, label: t('within25km') },
    { value: 50, label: t('within50km') },
  ];

  const categories = [
    { value: 'scenic', label: t('categoryScenic'), emoji: '🌅' },
    { value: 'smoke-spot', label: t('categorySmoke'), emoji: '💨' },
    { value: 'viewpoint', label: t('categoryViewpoint'), emoji: '🏔️' },
    { value: 'other', label: t('categoryOther'), emoji: '🌳' },
  ];

  const hasActiveFilters = selectedDistance !== null || selectedCategory !== null;

  return (
    <>
      {/* Filter Panel */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-[1999] flex items-start justify-end p-4 animate-fade-in"
          style={{ backgroundColor: '#0f172a' }}
        >
          {/* Backdrop */}
          <button
            type="button"
            className="absolute inset-0 bg-black/70 backdrop-blur-xl touch-manipulation"
            onClick={onClose}
            aria-label="Close filter panel"
          />
          
          {/* Panel */}
          <div 
            className="relative glass-card max-w-sm w-full max-h-[90vh] overflow-y-auto 
            custom-scrollbar animate-slide-left"
            style={{
              paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1.5rem)',
              paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)',
              paddingLeft: '1.5rem',
              paddingRight: '1.5rem'
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="glass-button p-2 rounded-full">
                  <SlidersHorizontal className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-xl font-bold text-white">{t('filters')}</h2>
              </div>
              <button
                onClick={onClose}
                className="glass-button p-2 rounded-full touch-manipulation"
                aria-label={t('close')}
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Distance Filter */}
            <div className="mb-6">
              <h3 className="text-white font-medium mb-3">{t('distance')}</h3>
              <div className="space-y-2">
                <button
                  onClick={() => onDistanceChange(null)}
                  className={`w-full px-4 py-3 rounded-xl text-left transition-all duration-200 touch-manipulation
                    ${selectedDistance === null 
                      ? 'bg-blue-500/30 border-2 border-blue-500/60 text-white backdrop-blur-xl' 
                      : 'bg-black/40 border border-white/10 text-white/70 hover:text-white hover:border-white/30 hover:bg-black/50 backdrop-blur-xl'
                    }`}
                >
                  {t('anyDistance')}
                </button>
                {distances.map((distance) => (
                  <button
                    key={distance.value}
                    onClick={() => onDistanceChange(distance.value)}
                    className={`w-full px-4 py-3 rounded-xl text-left transition-all duration-200 touch-manipulation
                      ${selectedDistance === distance.value 
                        ? 'bg-blue-500/30 border-2 border-blue-500/60 text-white backdrop-blur-xl' 
                        : 'bg-black/40 border border-white/10 text-white/70 hover:text-white hover:border-white/30 hover:bg-black/50 backdrop-blur-xl'
                      }`}
                  >
                    {distance.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Category Filter */}
            <div className="mb-6">
              <h3 className="text-white font-medium mb-3">{t('category')}</h3>
              <div className="space-y-2">
                <button
                  onClick={() => onCategoryChange(null)}
                  className={`w-full px-4 py-3 rounded-xl text-left transition-all duration-200 touch-manipulation
                    ${selectedCategory === null 
                      ? 'bg-blue-500/30 border-2 border-blue-500/60 text-white backdrop-blur-xl' 
                      : 'bg-black/40 border border-white/10 text-white/70 hover:text-white hover:border-white/30 hover:bg-black/50 backdrop-blur-xl'
                    }`}
                >
                  {t('allCategories')}
                </button>
                {categories.map((category) => (
                  <button
                    key={category.value}
                    onClick={() => onCategoryChange(category.value)}
                    className={`w-full px-4 py-3 rounded-xl text-left transition-all duration-200 touch-manipulation
                      flex items-center gap-2
                      ${selectedCategory === category.value 
                        ? 'bg-blue-500/30 border-2 border-blue-500/60 text-white backdrop-blur-xl' 
                        : 'bg-black/40 border border-white/10 text-white/70 hover:text-white hover:border-white/30 hover:bg-black/50 backdrop-blur-xl'
                      }`}
                  >
                    <span className="text-xl">{category.emoji}</span>
                    <span>{category.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Clear Filters Button */}
            {hasActiveFilters && (
              <button
                onClick={() => {
                  onClearFilters();
                  onClose();
                }}
                className="w-full px-4 py-3 rounded-xl font-medium touch-manipulation
                  bg-gradient-to-r from-red-500/20 to-pink-500/20 text-white
                  border border-red-500/30 hover:border-red-500/50
                  transition-all duration-200"
              >
                {t('clearFilters')}
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
