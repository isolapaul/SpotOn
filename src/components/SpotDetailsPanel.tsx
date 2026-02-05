'use client';

import { X, Heart, Star, MapPin, Share2, Calendar, User, Send } from 'lucide-react';
import Image from 'next/image';
import type { Spot } from '@/store/useSpotStore';
import { useUserStore } from '@/store/useUserStore';
import { useLanguageStore } from '@/store/useLanguageStore';
import { useSpotStore } from '@/store/useSpotStore';
import { useToastStore } from '@/store/useToastStore';
import { useState } from 'react';

interface SpotDetailsPanelProps {
  spot: Spot | null;
  onClose: () => void;
}

const categoryEmojis: Record<Spot['category'], string> = {
  scenic: '🌅',
  'smoke-spot': '💨',
  viewpoint: '🏔️',
  other: '📍',
};

const categoryLabels: Record<Spot['category'], { hu: string; en: string }> = {
  scenic: { hu: 'Festői Kilátás', en: 'Scenic View' },
  'smoke-spot': { hu: 'Pihenőhely', en: 'Smoke Spot' },
  viewpoint: { hu: 'Kilátópont', en: 'Viewpoint' },
  other: { hu: 'Egyéb', en: 'Other' },
};

export default function SpotDetailsPanel({ spot, onClose }: Readonly<SpotDetailsPanelProps>) {
  const { user, toggleFavorite } = useUserStore();
  const { language, t } = useLanguageStore();
  const { addReview } = useSpotStore();
  const { addToast } = useToastStore();
  const [isFavorite, setIsFavorite] = useState(
    spot ? user?.savedSpots?.includes(spot.id) || false : false
  );
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!spot) return null;

  const handleFavoriteToggle = async () => {
    if (!user) return;
    try {
      await toggleFavorite(spot.id);
      setIsFavorite(!isFavorite);
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  const handleSubmitReview = async () => {
    if (!user) {
      addToast(t('mustBeLoggedIn'), 'error');
      return;
    }
    if (rating === 0) {
      addToast('Kérlek adj értékelést!', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await addReview(spot.id, {
        userId: user.uid,
        userName: user.name || 'Névtelen',
        userPhoto: user.photoURL,
        rating,
        comment,
      });
      addToast('Értékelés sikeresen hozzáadva!', 'success');
      setRating(0);
      setComment('');
    } catch (error) {
      console.error('Error submitting review:', error);
      addToast('Hiba az értékelés hozzáadásakor', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: spot.name,
          text: spot.description,
          url: window.location.href,
        });
      } catch (err) {
        console.log('Share cancelled');
      }
    }
  };

  // Platform detection for navigation
  const getPlatform = () => {
    const userAgent = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(userAgent)) return 'ios';
    if (/android/.test(userAgent)) return 'android';
    return 'desktop';
  };

  const getNavigationUrl = () => {
    const platform = getPlatform();
    const { lat, lng } = spot.location;
    
    if (platform === 'ios') {
      return `maps://maps.apple.com/?q=${lat},${lng}`;
    }
    // Android and Desktop use Google Maps
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Unknown';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString(language === 'hu' ? 'hu-HU' : 'en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const averageRating = spot.reviews && spot.reviews.length > 0
    ? spot.reviews.reduce((acc, r) => acc + r.rating, 0) / spot.reviews.length
    : 0;

  return (
    <div className="fixed inset-0 z-[3000] animate-slide-up">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Panel */}
      <div className="absolute inset-0 flex flex-col bg-gradient-to-b from-slate-900 to-slate-800">
        {/* Hero Image */}
        <div className="relative w-full h-[40vh] flex-shrink-0">
          <Image
            src={spot.imageUrl}
            alt={spot.name}
            fill
            className="object-cover"
            priority
          />
          
          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-slate-900/80" />
          
          {/* Action Buttons */}
          <div className="absolute top-4 left-4 right-4 flex justify-between items-center">
            <button
              onClick={onClose}
              className="glass-button p-3 rounded-full"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-white" />
            </button>
            
            <div className="flex gap-2">
              {user && (
                <button
                  onClick={handleFavoriteToggle}
                  className="glass-button p-3 rounded-full"
                  aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                >
                  <Heart
                    className={`w-5 h-5 ${
                      isFavorite ? 'fill-red-500 text-red-500' : 'text-white'
                    }`}
                  />
                </button>
              )}
              
              <button
                onClick={handleShare}
                className="glass-button p-3 rounded-full"
                aria-label="Share"
              >
                <Share2 className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>
          
          {/* Category Badge */}
          <div className="absolute bottom-4 left-4">
            <div className="glass-card px-4 py-2 flex items-center gap-2">
              <span className="text-2xl">{categoryEmojis[spot.category]}</span>
              <span className="text-white font-medium">{categoryLabels[spot.category][language || 'hu']}</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-6 space-y-6">
          {/* Title & Rating */}
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">{spot.name}</h1>
            
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`w-5 h-5 ${
                      star <= Math.round(averageRating)
                        ? 'text-yellow-400 fill-yellow-400'
                        : 'text-white/30'
                    }`}
                  />
                ))}
                <span className="text-white font-semibold ml-2">
                  {averageRating > 0 ? averageRating.toFixed(1) : '-'}
                </span>
              </div>
              <span className="text-white/60">
                ({spot.reviews?.length || 0} {t('reviews')})
              </span>
            </div>
          </div>

          {/* Location */}
          <div className="glass-card p-4 flex items-start gap-3">
            <MapPin className="w-5 h-5 text-primary-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-white/80 text-sm">
                {spot.location.lat.toFixed(6)}, {spot.location.lng.toFixed(6)}
              </p>
              <a 
                href={getNavigationUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-400 text-sm font-medium mt-1 hover:underline inline-block"
              >
                {t('openInMaps')} →
              </a>
            </div>
          </div>

          {/* Description */}
          {spot.description && (
            <div>
              <h2 className="text-xl font-bold text-white mb-3">{t('description')}</h2>
              <p className="text-white/80 leading-relaxed">{spot.description}</p>
            </div>
          )}

          {/* Meta Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="glass-card p-4">
              <div className="flex items-center gap-2 text-white/60 mb-1">
                <Calendar className="w-4 h-4" />
                <span className="text-xs uppercase">{t('addedOn')}</span>
              </div>
              <p className="text-white font-medium">{formatDate(spot.createdAt)}</p>
            </div>
            
            <div className="glass-card p-4">
              <div className="flex items-center gap-2 text-white/60 mb-1">
                <User className="w-4 h-4" />
                <span className="text-xs uppercase">{t('by')}</span>
              </div>
              <p className="text-white font-medium">{t('anonymous')}</p>
            </div>
          </div>

          {/* Reviews Section Placeholder */}
          <div>
            <h2 className="text-xl font-bold text-white mb-3">{t('reviews')}</h2>
            <div className="glass-card p-6 text-center">
              <Star className="w-12 h-12 text-white/40 mx-auto mb-3" />
              <p className="text-white/60">{t('noReviews')}</p>
              <p className="text-white/40 text-sm mt-1">{t('beFirstToReview')}</p>
            </div>
          </div>

          {/* CTA Button */}
          <a
            href={getNavigationUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-4 rounded-2xl font-semibold text-lg
              bg-gradient-to-r from-primary-500 to-primary-600 text-white
              shadow-lg shadow-primary-500/30 
              hover:shadow-xl hover:shadow-primary-500/40 
              active:scale-98 transition-all duration-200
              flex items-center justify-center gap-2"
          >
            <MapPin className="w-5 h-5" />
            <span>{t('getDirections')}</span>
          </a>

          {/* Bottom Padding for safe area */}
          <div className="h-20" />
        </div>
      </div>
    </div>
  );
}
