'use client';

import { useState, useMemo, useCallback } from 'react';
import { X, Navigation, Star } from 'lucide-react';
import { useSpotStore } from '@/store/useSpotStore';
import { useT } from '@/hooks/useT';
import { CATEGORIES } from '@/lib/categories';
import { haversineKm } from '@/lib/geo';
import { averageRating } from '@/lib/rating';
import { DISCOVERY_BATCH_SIZE } from '@/lib/constants';
import type { Spot, SpotCategory } from '@/store/useSpotStore';
import CategoryIcon from '@/components/ui/CategoryIcon';
import PanelShell from './ui/PanelShell';
import FeaturedSpot from './discovery/FeaturedSpot';
import SpotRow from './discovery/SpotRow';

interface DiscoveryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  userLocation: { lat: number; lng: number } | null;
  onSpotSelect: (spot: Spot) => void;
}

type SortOption = 'nearest' | 'best-rated';

const chipClass = (active: boolean) =>
  `no-min-size flex-shrink-0 h-9 px-3.5 rounded-full text-[14px] font-semibold flex items-center gap-1.5 touch-manipulation
   transition-colors duration-200 active:scale-95 ${active ? 'bg-brand-600 text-white' : 'bg-white/[.08] text-label-secondary'}`;

/** Explore (design phase 3): large title, segmented sort, category chips, a featured spot and a grouped list. */
export default function DiscoveryPanel({ isOpen, onClose, userLocation, onSpotSelect }: Readonly<DiscoveryPanelProps>) {
  const { spots } = useSpotStore();
  const t = useT();
  const [sortBy, setSortBy] = useState<SortOption>('best-rated');
  const [filterCategory, setFilterCategory] = useState<SpotCategory | null>(null);
  const [visibleCount, setVisibleCount] = useState(DISCOVERY_BATCH_SIZE);

  const getDistance = useCallback(
    (spot: Spot): number | null =>
      userLocation ? haversineKm(userLocation.lat, userLocation.lng, spot.location.lat, spot.location.lng) : null,
    [userLocation],
  );

  const approvedCount = useMemo(() => spots.filter((s) => s.status === 'approved').length, [spots]);

  // Approved only, the category filter, then the chosen order.
  const sortedSpots = useMemo(() => {
    const filtered = spots.filter((spot) => spot.status === 'approved' && (!filterCategory || spot.category === filterCategory));
    if (sortBy === 'nearest' && userLocation) {
      filtered.sort((a, b) => (getDistance(a) ?? Infinity) - (getDistance(b) ?? Infinity));
    } else {
      filtered.sort((a, b) => averageRating(b.reviews) - averageRating(a.reviews));
    }
    return filtered;
  }, [spots, filterCategory, sortBy, userLocation, getDistance]);

  const displayedSpots = useMemo(() => sortedSpots.slice(0, visibleCount), [sortedSpots, visibleCount]);
  const hasMore = visibleCount < sortedSpots.length;

  const handleSortChange = (option: SortOption) => {
    if (option === 'nearest' && !userLocation) return;
    setSortBy(option);
    setVisibleCount(DISCOVERY_BATCH_SIZE);
  };
  const pickCategory = (category: SpotCategory | null) => {
    setFilterCategory(category);
    setVisibleCount(DISCOVERY_BATCH_SIZE);
  };

  if (!isOpen) return null;

  const [featured, ...rest] = displayedSpots;
  const props = (spot: Spot) => ({
    spot,
    rating: averageRating(spot.reviews),
    reviewCount: spot.reviews?.length || 0,
    distanceKm: getDistance(spot),
    onSelect: () => onSpotSelect(spot),
  });

  return (
    <PanelShell onClose={onClose} backdropLabel="Close discovery panel" variant="surface">
      <div className="flex-1 overflow-y-auto overscroll-contain" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)' }}>
        {/* Large title */}
        <header className="px-5 flex items-end justify-between gap-3" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1.75rem)' }}>
          <div className="min-w-0">
            <h2 className="text-[34px] leading-tight font-bold text-label">{t('discovery')}</h2>
            <p className="text-[15px] text-label-secondary tabular-nums">
              {t(approvedCount === 1 ? 'spotCountOne' : 'spotCountMany', { count: approvedCount })}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('close')}
            className="no-min-size mb-1.5 w-11 h-11 -mr-1.5 grid place-items-center rounded-full touch-manipulation"
          >
            <span className="w-[30px] h-[30px] rounded-full grid place-items-center bg-white/10">
              <X className="w-4 h-4 text-label-secondary" strokeWidth={2.5} />
            </span>
          </button>
        </header>

        {/* Segmented sort */}
        <div className="px-5 mt-4">
          <div role="radiogroup" className="relative grid grid-cols-2 p-0.5 rounded-[10px] bg-white/[.08]">
            <span
              aria-hidden="true"
              className="absolute top-0.5 bottom-0.5 left-0.5 w-[calc(50%-2px)] rounded-[8px] bg-white/[.16] shadow-sm transition-transform duration-350 ease-ios"
              style={{ transform: sortBy === 'nearest' ? 'translateX(0)' : 'translateX(100%)' }}
            />
            {(
              [
                { id: 'nearest', label: t('nearestToMe'), Icon: Navigation, disabled: !userLocation },
                { id: 'best-rated', label: t('bestRated'), Icon: Star, disabled: false },
              ] as const
            ).map(({ id, label, Icon, disabled }) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={sortBy === id}
                disabled={disabled}
                onClick={() => handleSortChange(id)}
                className="no-min-size relative h-8 flex items-center justify-center gap-1.5 text-[13px] font-semibold text-label touch-manipulation disabled:opacity-40"
              >
                <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="truncate">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Category chips */}
        <div className="mt-3 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button type="button" aria-pressed={filterCategory === null} onClick={() => pickCategory(null)} className={chipClass(filterCategory === null)}>
            {t('allCategories')}
          </button>
          {CATEGORIES.map((c) => (
            <button key={c.id} type="button" aria-pressed={filterCategory === c.id} onClick={() => pickCategory(c.id)} className={chipClass(filterCategory === c.id)}>
              <CategoryIcon category={c.id} className="w-4 h-4" />
              {t(c.labelKey)}
            </button>
          ))}
        </div>

        {displayedSpots.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
            <span className="w-16 h-16 rounded-2xl grid place-items-center bg-brand-500/15 text-brand-400 mb-4">
              <CategoryIcon category={filterCategory ?? 'other'} className="w-8 h-8" />
            </span>
            <p className="text-label-secondary">{t('noSpotsFound')}</p>
          </div>
        ) : (
          <div key={`${sortBy}-${filterCategory ?? 'all'}`} className="px-4 mt-4 space-y-4">
            <FeaturedSpot {...props(featured)} />
            {rest.length > 0 && (
              <div className="rounded-[18px] bg-surface-1 overflow-hidden divide-y divide-white/[.06]">
                {rest.map((spot, i) => (
                  <SpotRow key={spot.id} {...props(spot)} index={i} />
                ))}
              </div>
            )}
            {hasMore ? (
              <button
                type="button"
                onClick={() => setVisibleCount((c) => c + DISCOVERY_BATCH_SIZE)}
                className="w-full h-12 rounded-[14px] bg-white/[.08] text-brand-400 font-semibold text-[15px] touch-manipulation active:bg-white/[.12]"
              >
                {t('loadMore')} ({sortedSpots.length - visibleCount} {t('spots')})
              </button>
            ) : (
              <p className="text-center text-label-tertiary text-[13px] py-3">{t('noMoreSpots')}</p>
            )}
          </div>
        )}
      </div>
    </PanelShell>
  );
}
