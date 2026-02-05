'use client';

import { useLanguageStore } from '@/store/useLanguageStore';
import { SlidersHorizontal, X } from 'lucide-react';
import { useState } from 'react';

interface FilterPanelProps {
  selectedDistance: number | null;
  selectedCategory: string | null;
  onDistanceChange: (distance: number | null) => void;
  onCategoryChange: (category: string | null) => void;
  onClearFilters: () => void;
}

export default function FilterPanel({
  selectedDistance,
  selectedCategory,
  onDistanceChange,
  onCategoryChange,
  onClearFilters,
}: Readonly<FilterPanelProps>) {
  const { t, language } = useLanguageStore();
  const [isOpen, setIsOpen] = useState(false);

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
      {/* Filter Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed top-4 right-4 z-[1000] glass-button p-3 rounded-full shadow-lg
          ${hasActiveFilters ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20' : ''}
          hover:scale-105 active:scale-95 transition-all duration-200`}
        aria-label={t('filters')}
      >
        <SlidersHorizontal className="w-6 h-6 text-white" />
        {hasActiveFilters && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 rounded-full 
            flex items-center justify-center text-xs text-white font-bold">
            {(selectedDistance ? 1 : 0) + (selectedCategory ? 1 : 0)}
          </span>
        )}
      </button>

      {/* Filter Panel */}
      {isOpen && (
        <div className="fixed inset-0 z-[1999] flex items-start justify-end p-4 animate-fade-in">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Panel */}
          <div className="relative glass-card max-w-sm w-full max-h-[90vh] overflow-y-auto 
            custom-scrollbar p-6 animate-slide-left mt-16">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="glass-button p-2 rounded-full">
                  <SlidersHorizontal className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-xl font-bold text-white">{t('filters')}</h2>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="glass-button p-2 rounded-full"
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
                  className={`w-full px-4 py-3 rounded-xl text-left transition-all duration-200
                    ${selectedDistance === null 
                      ? 'glass-card border-2 border-blue-500/50 text-white' 
                      : 'glass border border-white/10 text-white/70 hover:text-white hover:border-white/30'
                    }`}
                >
                  {t('anyDistance')}
                </button>
                {distances.map((distance) => (
                  <button
                    key={distance.value}
                    onClick={() => onDistanceChange(distance.value)}
                    className={`w-full px-4 py-3 rounded-xl text-left transition-all duration-200
                      ${selectedDistance === distance.value 
                        ? 'glass-card border-2 border-blue-500/50 text-white' 
                        : 'glass border border-white/10 text-white/70 hover:text-white hover:border-white/30'
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
                  className={`w-full px-4 py-3 rounded-xl text-left transition-all duration-200
                    ${selectedCategory === null 
                      ? 'glass-card border-2 border-blue-500/50 text-white' 
                      : 'glass border border-white/10 text-white/70 hover:text-white hover:border-white/30'
                    }`}
                >
                  {t('allCategories')}
                </button>
                {categories.map((category) => (
                  <button
                    key={category.value}
                    onClick={() => onCategoryChange(category.value)}
                    className={`w-full px-4 py-3 rounded-xl text-left transition-all duration-200 
                      flex items-center gap-2
                      ${selectedCategory === category.value 
                        ? 'glass-card border-2 border-blue-500/50 text-white' 
                        : 'glass border border-white/10 text-white/70 hover:text-white hover:border-white/30'
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
                  setIsOpen(false);
                }}
                className="w-full px-4 py-3 rounded-xl font-medium
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
