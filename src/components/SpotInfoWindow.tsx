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

export default function SpotInfoWindow({ spot, onClose, onViewDetails }: Readonly<SpotInfoWindowProps>) {
  const { user, toggleFavorite } = useUserStore();
  const { t } = useLanguageStore();
  const [isFavorite, setIsFavorite] = useState(
    user?.savedSpots?.includes(spot.id) || false
  );

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
    <div className="glass-card w-[300px] overflow-hidden animate-slide-up">
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
          <p className="text-white/60 text-xs capitalize">
            {spot.category.replace('-', ' ')}
          </p>
        </div>

        {/* Description */}
        {spot.description && (
          <p className="text-white/80 text-sm line-clamp-2">
            {spot.description}
          </p>
        )}

        {/* Rating Placeholder */}
        <div className="flex items-center gap-1">
          <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
          <span className="text-white/80 text-sm">4.5</span>
          <span className="text-white/40 text-xs">(12 reviews)</span>
        </div>

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
