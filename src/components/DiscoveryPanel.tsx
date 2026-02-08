'use client';

import { useState, useMemo, useCallback } from 'react';
import { X, Star, MapPin, ArrowUpDown, Filter, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { useSpotStore } from '@/store/useSpotStore';
import { useLanguageStore } from '@/store/useLanguageStore';
import { categoryEmojis, categoryTranslationKeys } from '@/lib/spotUtils';
import type { Spot, SpotCategory } from '@/store/useSpotStore';

interface DiscoveryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  userLocation: { lat: number; lng: number } | null;
  onSpotSelect: (spot: Spot) => void;
}

type SortOption = 'nearest' | 'best-rated';

const BATCH_SIZE = 20;

// Haversine distance calculation
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function DiscoveryPanel({ isOpen, onClose, userLocation, onSpotSelect }: Readonly<DiscoveryPanelProps>) {
  const { spots } = useSpotStore();
  const { t } = useLanguageStore();
  const [sortBy, setSortBy] = useState<SortOption>('best-rated');
  const [filterCategory, setFilterCategory] = useState<SpotCategory | null>(null);
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const [showFilters, setShowFilters] = useState(false);

  const categories: { value: SpotCategory; label: string; emoji: string }[] = [
    { value: 'scenic', label: t('categoryScenic'), emoji: '🌅' },
    { value: 'smoke-spot', label: t('categorySmoke'), emoji: '💨' },
    { value: 'viewpoint', label: t('categoryViewpoint'), emoji: '🏔️' },
    { value: 'hiking', label: t('categoryHiking'), emoji: '🥾' },
    { value: 'random', label: t('categoryRandom'), emoji: '🎲' },
    { value: 'date-spot', label: t('categoryDateSpot'), emoji: '❤️' },
    { value: 'park', label: t('categoryPark'), emoji: '🌳' },
    { value: 'other', label: t('categoryOther'), emoji: '📍' },
  ];

  // Get distance for a spot (returns null if no user location)
  const getDistance = useCallback((spot: Spot): number | null => {
    if (!userLocation) return null;
    return calculateDistance(
      userLocation.lat, userLocation.lng,
      spot.location.lat, spot.location.lng
    );
  }, [userLocation]);

  // Compute average rating for a spot
  const getAverageRating = useCallback((spot: Spot): number => {
    if (!spot.reviews || spot.reviews.length === 0) return 0;
    return spot.reviews.reduce((acc, r) => acc + r.rating, 0) / spot.reviews.length;
  }, []);

  // Filter and sort spots
  const sortedSpots = useMemo(() => {
    // Only show approved spots
    let filtered = spots.filter(spot => spot.status === 'approved');

    // Apply category filter
    if (filterCategory) {
      filtered = filtered.filter(spot => spot.category === filterCategory);
    }

    // Sort
    if (sortBy === 'nearest' && userLocation) {
      filtered.sort((a, b) => {
        const distA = getDistance(a) ?? Infinity;
        const distB = getDistance(b) ?? Infinity;
        return distA - distB;
      });
    } else {
      // Best rated (default)
      filtered.sort((a, b) => {
        const ratingA = getAverageRating(a);
        const ratingB = getAverageRating(b);
        return ratingB - ratingA;
      });
    }

    return filtered;
  }, [spots, filterCategory, sortBy, userLocation, getDistance, getAverageRating]);

  // Paginated spots
  const displayedSpots = useMemo(() => {
    return sortedSpots.slice(0, visibleCount);
  }, [sortedSpots, visibleCount]);

  const hasMore = visibleCount < sortedSpots.length;

  const handleLoadMore = () => {
    setVisibleCount(prev => prev + BATCH_SIZE);
  };

  const handleSortChange = (option: SortOption) => {
    if (option === 'nearest' && !userLocation) {
      return;
    }
    setSortBy(option);
    setVisibleCount(BATCH_SIZE);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2500] animate-slide-up" style={{ backgroundColor: '#0f172a' }}>
      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-xl cursor-default"
        onClick={onClose}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
        aria-label="Close discovery panel"
        tabIndex={-1}
      />

      {/* Panel */}
      <div className="absolute inset-0 flex flex-col bg-gray-900/95 backdrop-blur-2xl">
        {/* Header */}
        <div className="flex-shrink-0 px-6 border-b border-white/10" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)', paddingBottom: '1rem' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="glass-button p-2 rounded-full">
                <MapPin className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-xl font-bold text-white">{t('discovery')}</h2>
            </div>
            <button
              onClick={onClose}
              className="glass-button p-2 rounded-full"
              aria-label={t('close')}
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Sort & Filter Bar */}
          <div className="flex gap-2 mb-3">
            {/* Sort Buttons */}
            <button
              onClick={() => handleSortChange('nearest')}
              className={`flex-1 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                sortBy === 'nearest'
                  ? 'bg-primary-500/30 border border-primary-500/60 text-white'
                  : 'bg-white/5 border border-white/10 text-white/60'
              } ${!userLocation ? 'opacity-50' : ''}`}
            >
              📍 {t('nearestToMe')}
            </button>
            <button
              onClick={() => handleSortChange('best-rated')}
              className={`flex-1 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                sortBy === 'best-rated'
                  ? 'bg-primary-500/30 border border-primary-500/60 text-white'
                  : 'bg-white/5 border border-white/10 text-white/60'
              }`}
            >
              ⭐ {t('bestRated')}
            </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                filterCategory
                  ? 'bg-amber-500/30 border border-amber-500/60 text-white'
                  : 'bg-white/5 border border-white/10 text-white/60'
              }`}
            >
              <Filter className="w-4 h-4" />
            </button>
          </div>

          {/* Category Filter Chips */}
          {showFilters && (
            <div className="flex flex-wrap gap-2 pb-3">
              <button
                onClick={() => { setFilterCategory(null); setVisibleCount(BATCH_SIZE); }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  filterCategory === null
                    ? 'bg-primary-500/30 border border-primary-500/60 text-white'
                    : 'bg-white/5 border border-white/10 text-white/60'
                }`}
              >
                {t('allCategories')}
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => { setFilterCategory(cat.value); setVisibleCount(BATCH_SIZE); }}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1 ${
                    filterCategory === cat.value
                      ? 'bg-primary-500/30 border border-primary-500/60 text-white'
                      : 'bg-white/5 border border-white/10 text-white/60'
                  }`}
                >
                  <span>{cat.emoji}</span>
                  <span>{cat.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Spot List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pt-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)' }}>
          {displayedSpots.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <MapPin className="w-16 h-16 text-white/20 mb-4" />
              <p className="text-white/60 text-center">{t('noSpotsFound')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {displayedSpots.map((spot) => {
                const distance = getDistance(spot);
                const rating = getAverageRating(spot);
                const reviewCount = spot.reviews?.length || 0;

                return (
                  <button
                    key={spot.id}
                    onClick={() => onSpotSelect(spot)}
                    className="w-full glass-card p-3 flex gap-3 text-left hover:bg-white/10 transition-all active:scale-[0.98]"
                  >
                    {/* Thumbnail */}
                    <div className="relative w-20 h-20 rounded-xl overflow-hidden flex-shrink-0">
                      <Image
                        src={spot.imageUrl}
                        alt={spot.name}
                        fill
                        className="object-cover"
                        sizes="80px"
                      />
                      {/* Category Badge */}
                      <div className="absolute bottom-1 left-1 bg-black/60 rounded-full px-1.5 py-0.5">
                        <span className="text-xs">{categoryEmojis[spot.category] || '📍'}</span>
                      </div>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 py-0.5">
                      <h3 className="text-white font-semibold text-sm line-clamp-1 mb-1">{spot.name}</h3>

                      {/* Rating */}
                      <div className="flex items-center gap-1 mb-1">
                        {rating > 0 ? (
                          <>
                            <div className="flex gap-0.5">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  className={`w-3 h-3 ${
                                    star <= Math.round(rating)
                                      ? 'text-yellow-400 fill-yellow-400'
                                      : 'text-white/20'
                                  }`}
                                />
                              ))}
                            </div>
                            <span className="text-white/70 text-xs ml-1">
                              {rating.toFixed(1)} ({reviewCount})
                            </span>
                          </>
                        ) : (
                          <span className="text-white/40 text-xs">{t('noRating')}</span>
                        )}
                      </div>

                      {/* Distance */}
                      {distance !== null && (
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-primary-400" />
                          <span className="text-white/60 text-xs">
                            {distance < 1
                              ? `${Math.round(distance * 1000)} m`
                              : `${distance.toFixed(1)} km`}
                          </span>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}

              {/* Load More */}
              {hasMore ? (
                <button
                  onClick={handleLoadMore}
                  className="w-full py-3 rounded-xl glass-button text-white/80 font-medium text-sm
                    hover:bg-white/10 transition-all"
                >
                  {t('loadMore')} ({sortedSpots.length - visibleCount} {t('spots')})
                </button>
              ) : displayedSpots.length > 0 ? (
                <p className="text-center text-white/40 text-sm py-4">
                  {t('noMoreSpots')}
                </p>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
