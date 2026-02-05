'use client';

import { X, Heart, Star, MapPin } from 'lucide-react';
import Image from 'next/image';
import type { Spot } from '@/store/useSpotStore';
import { useUserStore } from '@/store/useUserStore';
import { useLanguageStore } from '@/store/useLanguageStore';
import { useState } from 'react';

interface SpotInfoWindowProps {
  spot: Spot;
  onClose: () => void;
  onViewDetails: () => void;
}

const categoryEmojis: Record<Spot['category'], string> = {
  scenic: '🌅',
  'smoke-spot': '💨',
  viewpoint: '🏔️',
  other: '📍',
};

const categoryLabels: Record<Spot['category'], { hu: string; en: string; de: string }> = {
  scenic: { hu: 'Festői Kilátás', en: 'Scenic View', de: 'Malerische Aussicht' },
  'smoke-spot': { hu: 'Pihenőhely', en: 'Smoke Spot', de: 'Rastplatz' },
  viewpoint: { hu: 'Kilátópont', en: 'Viewpoint', de: 'Aussichtspunkt' },
  other: { hu: 'Egyéb', en: 'Other', de: 'Sonstiges' },
};

export default function SpotInfoWindow({ spot, onClose, onViewDetails }: Readonly<SpotInfoWindowProps>) {
  const { user, toggleFavorite } = useUserStore();
  const { language, t } = useLanguageStore();
  const [isFavorite, setIsFavorite] = useState(
    user?.savedSpots?.includes(spot.id) || false
  );

  const averageRating = spot.reviews && spot.reviews.length > 0
    ? spot.reviews.reduce((acc, r) => acc + r.rating, 0) / spot.reviews.length
    : 0;
  const reviewCount = spot.reviews?.length || 0;

  const handleFavoriteToggle = async () => {
    if (!user) return;
    try {
      await toggleFavorite(spot.id);
      setIsFavorite(!isFavorite);
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  return (
    <div className="w-[300px] overflow-hidden animate-slide-up bg-slate-900/95 backdrop-blur-xl border border-white/30 shadow-2xl rounded-3xl">
      {/* Close Button */}
      <button
        onClick={onClose}
        className="absolute top-2 right-2 z-10 glass-button p-1.5 rounded-full"
        aria-label="Close"
      >
        <X className="w-4 h-4 text-white" />
      </button>

      {/* Image */}
      <div className="relative w-full h-40">
        <Image
          src={spot.imageUrl}
          alt={spot.name}
          fill
          className="object-cover"
          sizes="300px"
        />
        
        {/* Favorite Button */}
        {user && (
          <button
            onClick={handleFavoriteToggle}
            className="absolute bottom-2 right-2 glass-button p-2 rounded-full"
            aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Heart
              className={`w-5 h-5 ${
                isFavorite ? 'fill-red-500 text-red-500' : 'text-white'
              }`}
            />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Title & Category */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">{categoryEmojis[spot.category]}</span>
            <h3 className="text-lg font-bold text-white line-clamp-1">
              {spot.name}
            </h3>
          </div>
          <p className="text-white/60 text-xs">
            {categoryLabels[spot.category][language || 'hu']}
          </p>
        </div>

        {/* Description */}
        {spot.description && (
          <p className="text-white/80 text-sm line-clamp-2">
            {spot.description}
          </p>
        )}

        {/* Rating */}
        {reviewCount > 0 ? (
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`w-4 h-4 ${
                  star <= Math.round(averageRating)
                    ? 'text-yellow-400 fill-yellow-400'
                    : 'text-white/30'
                }`}
              />
            ))}
            <span className="text-white/80 text-sm ml-1">{averageRating.toFixed(1)}</span>
            <span className="text-white/40 text-xs">({reviewCount} {t('reviews')})</span>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <Star className="w-4 h-4 text-white/30" />
            <span className="text-white/40 text-xs">{t('noReviews')}</span>
          </div>
        )}

        {/* View Details Button */}
        <button
          onClick={onViewDetails}
          className="w-full py-2.5 rounded-xl font-medium
            bg-gradient-to-r from-primary-500 to-primary-600 text-white
            shadow-lg shadow-primary-500/20
            hover:shadow-xl hover:shadow-primary-500/30
            active:scale-98 transition-all duration-200
            flex items-center justify-center gap-2"
        >
          <MapPin className="w-4 h-4" />
          <span>{t('viewDetails')}</span>
        </button>
      </div>
    </div>
  );
}
