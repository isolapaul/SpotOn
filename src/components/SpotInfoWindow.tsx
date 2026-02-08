'use client';

import { X, Heart, Star, MapPin, CheckCircle, Navigation } from 'lucide-react';
import Image from 'next/image';
import type { Spot } from '@/store/useSpotStore';
import { useUserStore } from '@/store/useUserStore';
import { useLanguageStore } from '@/store/useLanguageStore';
import { useSpotStore } from '@/store/useSpotStore';
import { useToastStore } from '@/store/useToastStore';
import { categoryEmojis, categoryLabels, getNavigationUrl } from '@/lib/spotUtils';
import { useState } from 'react';

interface SpotInfoWindowProps {
  spot: Spot;
  isAdmin?: boolean;
  onClose: () => void;
  onViewDetails: () => void;
}

export default function SpotInfoWindow({ spot, isAdmin = false, onClose, onViewDetails }: Readonly<SpotInfoWindowProps>) {
  const { user, toggleFavorite } = useUserStore();
  const { language, t } = useLanguageStore();
  const { approveSpot } = useSpotStore();
  const { showToast } = useToastStore();
  const [isFavorite, setIsFavorite] = useState(
    user?.savedSpots?.includes(spot.id) || false
  );
  const [isApproving, setIsApproving] = useState(false);

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

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      await approveSpot(spot.id);
      showToast(
        language === 'hu' ? 'Hely jóváhagyva!' : language === 'de' ? 'Ort genehmigt!' : 'Spot approved!',
        'success'
      );
      onClose();
    } catch (error) {
      console.error('Error approving spot:', error);
      showToast(
        language === 'hu' ? 'Hiba a jóváhagyáskor' : language === 'de' ? 'Fehler bei der Genehmigung' : 'Error approving spot',
        'error'
      );
    } finally {
      setIsApproving(false);
    }
  };

  const navigationUrl = getNavigationUrl(spot.location.lat, spot.location.lng);

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

        {/* Admin Approve Button */}
        {isAdmin && spot.status === 'pending' && (
          <button
            onClick={handleApprove}
            disabled={isApproving}
            className="w-full py-2.5 rounded-xl font-medium mb-2
              bg-gradient-to-r from-green-500 to-green-600 text-white
              shadow-lg shadow-green-500/20
              hover:shadow-xl hover:shadow-green-500/30
              active:scale-98 transition-all duration-200
              disabled:opacity-50 disabled:cursor-not-allowed
              flex items-center justify-center gap-2"
          >
            <CheckCircle className="w-4 h-4" />
            <span>
              {isApproving 
                ? (language === 'hu' ? 'Jóváhagyás...' : language === 'de' ? 'Genehmigung...' : 'Approving...')
                : (language === 'hu' ? 'Hely Jóváhagyása' : language === 'de' ? 'Ort genehmigen' : 'Approve Spot')
              }
            </span>
          </button>
        )}

        {/* Status Badge for Admin */}
        {isAdmin && (
          <div className="mb-2">
            <span className={`text-xs px-2 py-1 rounded-full ${
              spot.status === 'approved' 
                ? 'bg-green-500/20 text-green-400'
                : 'bg-yellow-500/20 text-yellow-400'
            }`}>
              {spot.status === 'approved' ? t('approved') : t('pending')}
            </span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-2">
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

          {/* Get Directions Button */}
          <a
            href={navigationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-2.5 rounded-xl font-medium
              bg-gradient-to-r from-blue-500 to-blue-600 text-white
              shadow-lg shadow-blue-500/20
              hover:shadow-xl hover:shadow-blue-500/30
              active:scale-98 transition-all duration-200
              flex items-center justify-center gap-2"
          >
            <Navigation className="w-4 h-4" />
            <span>{t('getDirections')}</span>
          </a>
        </div>
      </div>
    </div>
  );
}
