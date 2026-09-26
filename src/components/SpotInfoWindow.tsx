'use client';

import { X, Heart, Star, MapPin, CheckCircle, Navigation } from 'lucide-react';
import Image from 'next/image';
import type { Spot } from '@/store/useSpotStore';
import { useUserStore } from '@/store/useUserStore';
import { useT } from '@/hooks/useT';
import { useSpotStore } from '@/store/useSpotStore';
import { useToastStore } from '@/store/useToastStore';
import { categoryEmojis, categoryTranslationKeys, getNavigationUrl } from '@/lib/spotUtils';
import { getUserNameColor } from '@/lib/levelUtils';
import { averageRating } from '@/lib/rating';
import { getPreviewImageUrl, isImageUnoptimized, sortSpotImagesByLikes } from '@/lib/spotImages';
import { useState, useEffect } from 'react';
import { fetchPublicProfile } from '@/store/publicProfiles';
import StarRating from './ui/StarRating';

interface SpotInfoWindowProps {
  spot: Spot;
  isAdmin?: boolean;
  onClose: () => void;
  onViewDetails: () => void;
}

export default function SpotInfoWindow({ spot, isAdmin = false, onClose, onViewDetails }: Readonly<SpotInfoWindowProps>) {
  const { user, toggleFavorite } = useUserStore();
  const t = useT();
  const { approveSpot } = useSpotStore();
  const { showToast } = useToastStore();
  const [isFavorite, setIsFavorite] = useState(
    user?.savedSpots?.includes(spot.id) || false
  );
  const [isApproving, setIsApproving] = useState(false);
  const [creatorSpotsCount, setCreatorSpotsCount] = useState<number | null>(null);
  const [creatorName, setCreatorName] = useState<string | null>(null);
  const [creatorCustomNameColor, setCreatorCustomNameColor] = useState<string | undefined>();

  const avgRating = averageRating(spot.reviews);
  const reviewCount = spot.reviews?.length || 0;

  const handleFavoriteToggle = async () => {
    if (!user) return;
    try {
      await toggleFavorite(spot.id);
      setIsFavorite(!isFavorite);
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    }
  };

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      await approveSpot(spot.id);
      showToast(t('spotApproved'), 'success');
      onClose();
    } catch (error) {
      console.error('Failed to approve spot:', error);
      showToast(t('approveError'), 'error');
    } finally {
      setIsApproving(false);
    }
  };

  const navigationUrl = getNavigationUrl(spot.location.lat, spot.location.lng);

  useEffect(() => {
    if (!spot?.createdBy) return;
    let isMounted = true;

    const isSelf = spot.createdBy === user?.uid;
    if (isSelf) {
      setCreatorName(user.username || null);
      setCreatorCustomNameColor(user.customNameColor);
    }

    fetchPublicProfile(spot.createdBy)
      .then((p) => {
        if (!isMounted) return;
        setCreatorSpotsCount(p?.spotsCount ?? 0);
        if (!isSelf) {
          setCreatorName(p?.username ?? null);
          setCreatorCustomNameColor(p?.customNameColor ?? undefined);
        }
      })
      .catch((error) => console.error('Failed to fetch creator info:', error));

    return () => {
      isMounted = false;
    };
  }, [spot?.createdBy, user?.uid, user?.username, user?.customNameColor]);

  const creatorDisplayName = creatorName || spot.createdByName || t('anonymous');
  const creatorNameColor = getUserNameColor(
    creatorSpotsCount ?? 0,
    creatorCustomNameColor
  );

  // Most-liked image first ('bothRequired' tie-break: the info window's own order, kept as is).
  const sortedSpotImages = sortSpotImagesByLikes(spot.spotImages || [], 'bothRequired');
  const previewImageUrl = getPreviewImageUrl(spot, sortedSpotImages);

  return (
    <div className="w-[300px] overflow-hidden animate-slide-up bg-slate-900/95 backdrop-blur-xl border border-white/30 shadow-2xl rounded-3xl">
      {/* Close Button */}
      <button
        onClick={onClose}
        className="absolute top-2 right-2 z-10 glass-button p-2.5 rounded-full touch-manipulation min-w-[44px] min-h-[44px]"
        aria-label="Close"
      >
        <X className="w-4 h-4 text-white" />
      </button>

      {/* Image */}
      <div className="relative w-full h-40">
        <Image
          src={previewImageUrl}
          alt={spot.name}
          fill
          className="object-cover"
          sizes="300px"
          unoptimized={isImageUnoptimized(spot)}
        />
        
        {/* Favorite Button */}
        {user && (
          <button
            onClick={handleFavoriteToggle}
            className="absolute bottom-2 right-2 glass-button p-2 rounded-full touch-manipulation"
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
            {t(categoryTranslationKeys[spot.category])}
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
            <StarRating rating={Math.round(avgRating)} size="sm" emptyTone="dim" wrapper={false} />
            <span className="text-white/80 text-sm ml-1">{avgRating.toFixed(1)}</span>
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
            className="w-full py-2.5 rounded-xl font-medium mb-2 touch-manipulation
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
                ? t('approving')
                : t('approve')
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
            className="w-full py-2.5 rounded-xl font-medium touch-manipulation
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
            className="w-full py-2.5 rounded-xl font-medium touch-manipulation
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
