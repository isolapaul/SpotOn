'use client';

import { X, Heart, Star, MapPin, Share2, Calendar, User, Send, CheckCircle, Shield } from 'lucide-react';
import Image from 'next/image';
import type { Spot } from '@/store/useSpotStore';
import { useUserStore } from '@/store/useUserStore';
import { useLanguageStore } from '@/store/useLanguageStore';
import { useSpotStore, isAdmin as checkIsAdmin } from '@/store/useSpotStore';
import { useToastStore } from '@/store/useToastStore';
import { useState } from 'react';

interface SpotDetailsPanelProps {
  spot: Spot | null;
  isAdmin?: boolean;
  onClose: () => void;
}

const categoryEmojis: Record<Spot['category'], string> = {
  scenic: '🌅',
  'smoke-spot': '💨',
  viewpoint: '🏔️',
  other: '📍',
};

const categoryLabels: Record<Spot['category'], { hu: string; en: string; de: string }> = {
  scenic: { hu: 'Szép Kilátás', en: 'Scenic View', de: 'Malerische Aussicht' },
  'smoke-spot': { hu: 'Eldugott Spot', en: 'Hidden Spot', de: 'Versteckter Ort' },
  viewpoint: { hu: 'Kilátópont', en: 'Viewpoint', de: 'Aussichtspunkt' },
  other: { hu: 'Park/Bokor', en: 'Park/Bush', de: 'Park/Busch' },
};

export default function SpotDetailsPanel({ spot, isAdmin = false, onClose }: Readonly<SpotDetailsPanelProps>) {
  const { user, toggleFavorite } = useUserStore();
  const { language, t } = useLanguageStore();
  const { addReview, approveSpot } = useSpotStore();
  const { showToast } = useToastStore();
  const [isFavorite, setIsFavorite] = useState(
    spot ? user?.savedSpots?.includes(spot.id) || false : false
  );
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  if (!spot) return null;

  // Helper functions for multilingual messages to avoid nested ternaries
  const getApprovedMessage = () => {
    if (language === 'hu') return 'Hely jóváhagyva!';
    if (language === 'de') return 'Ort genehmigt!';
    return 'Spot approved!';
  };

  const getApproveErrorMessage = () => {
    if (language === 'hu') return 'Hiba a jóváhagyáskor';
    if (language === 'de') return 'Fehler bei der Genehmigung';
    return 'Error approving spot';
  };

  const getApprovingText = () => {
    if (language === 'hu') return 'Jóváhagyás...';
    if (language === 'de') return 'Genehmigung...';
    return 'Approving...';
  };

  const getApproveText = () => {
    if (language === 'hu') return 'Jóváhagyás';
    if (language === 'de') return 'Genehmigen';
    return 'Approve';
  };

  const getDateLocale = () => {
    return language === 'hu' ? 'hu-HU' : 'en-US';
  };

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
      showToast(t('mustBeLoggedIn'), 'error');
      return;
    }
    if (rating === 0) {
      showToast('Kérlek adj értékelést!', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await addReview(spot.id, {
        userId: user.uid,
        userName: user.name || 'Névtelen',
        userEmail: user.email,
        userPhoto: user.photoURL,
        rating,
        comment,
      });
      showToast('Értékelés sikeresen hozzáadva!', 'success');
      setRating(0);
      setComment('');
    } catch (error) {
      console.error('Error submitting review:', error);
      showToast('Hiba az értékelés hozzáadásakor', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprove = async () => {
    if (!spot) return;
    setIsApproving(true);
    try {
      await approveSpot(spot.id);
      showToast(getApprovedMessage(), 'success');
      setTimeout(() => onClose(), 1000);
    } catch (error) {
      console.error('Error approving spot:', error);
      showToast(getApproveErrorMessage(), 'error');
    } finally {
      setIsApproving(false);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: spot.name,
          text: spot.description,
          url: globalThis.location.href,
        });
      } catch (err) {
        // User cancelled sharing, this is expected behavior
        if (err instanceof Error && err.name !== 'AbortError') {
          console.error('Error sharing:', err);
        }
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
    return date.toLocaleDateString(getDateLocale(), { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const averageRating = spot.reviews && spot.reviews.length > 0
    ? spot.reviews.reduce((acc, r) => acc + r.rating, 0) / spot.reviews.length
    : 0;

  return (
    <div className="fixed inset-0 z-[3000] animate-slide-up" style={{ backgroundColor: '#0f172a' }}>
      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-xl cursor-default"
        onClick={onClose}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
        aria-label="Close spot details"
        tabIndex={-1}
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
          <div className="absolute left-4 right-4 flex justify-between items-center" style={{ top: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}>
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
        <div className="flex-1 overflow-y-auto custom-scrollbar px-6 pt-6" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)' }}>
          <div className="space-y-6">
          {/* Admin Status Badge & Approve Button */}
          {isAdmin && (
            <div className="glass-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                  spot.status === 'approved' 
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-yellow-500/20 text-yellow-400'
                }`}>
                  {spot.status === 'approved' ? t('approved') : t('pending')}
                </span>
                
                {spot.status === 'pending' && (
                  <button
                    onClick={handleApprove}
                    disabled={isApproving}
                    className="px-4 py-2 rounded-xl font-medium
                      bg-gradient-to-r from-green-500 to-green-600 text-white text-sm
                      shadow-lg shadow-green-500/20
                      hover:shadow-xl hover:shadow-green-500/30
                      active:scale-98 transition-all duration-200
                      disabled:opacity-50 disabled:cursor-not-allowed
                      flex items-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>
                      {isApproving ? getApprovingText() : getApproveText()}
                    </span>
                  </button>
                )}
              </div>
            </div>
          )}

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
              <div className="flex items-center gap-2">
                {spot.createdByPhoto && (
                  <div className="relative w-6 h-6 rounded-full overflow-hidden">
                    <Image src={spot.createdByPhoto} alt="User" fill className="object-cover" />
                  </div>
                )}
                <p className="text-white font-medium">
                  {spot.createdByName || t('anonymous')}
                </p>
              </div>
            </div>
          </div>

          {/* Reviews Section */}
          <div>
            <h2 className="text-xl font-bold text-white mb-4">{t('reviews')}</h2>
            
            {/* Add Review Form */}
            {user && (
              <div className="glass-card p-4 mb-4">
                <div className="flex items-center gap-3 mb-3">
                  {user.photoURL && (
                    <div className="relative w-10 h-10 rounded-full overflow-hidden">
                      <Image src={user.photoURL} alt={user.name || 'User'} fill className="object-cover" />
                    </div>
                  )}
                  <div>
                    <p className="text-white font-medium">{user.name}</p>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onClick={() => setRating(star)}
                          className="transition-all duration-200 active:scale-95"
                        >
                          <Star
                            className={`w-5 h-5 ${
                              star <= rating
                                ? 'text-yellow-400 fill-yellow-400'
                                : 'text-white/30'
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Írd le a véleményedet..."
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all resize-none"
                  rows={3}
                />
                
                <button
                  onClick={handleSubmitReview}
                  disabled={isSubmitting || rating === 0}
                  className="mt-3 w-full py-3 rounded-xl font-medium bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  <span>{isSubmitting ? 'Küldés...' : 'Értékelés küldése'}</span>
                </button>
              </div>
            )}

            {/* Reviews List */}
            <div className="space-y-3">
              {!spot.reviews || spot.reviews.length === 0 ? (
                <div className="glass-card p-6 text-center">
                  <Star className="w-12 h-12 text-white/40 mx-auto mb-3" />
                  <p className="text-white/60">{t('noReviews')}</p>
                  <p className="text-white/40 text-sm mt-1">{t('beFirstToReview')}</p>
                </div>
              ) : (
                spot.reviews.map((review) => (
                  <div key={review.id} className="glass-card p-4">
                    <div className="flex items-start gap-3">
                      {review.userPhoto && (
                        <div className="relative w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
                          <Image src={review.userPhoto} alt={review.userName} fill className="object-cover" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <p className="text-white font-medium">{review.userName}</p>
                            {checkIsAdmin(review.userEmail) && (
                              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30">
                                <Shield className="w-3 h-3 text-amber-400" />
                                <span className="text-amber-400 text-xs font-bold">Admin</span>
                              </div>
                            )}
                          </div>
                          <span className="text-white/40 text-xs">
                            {review.createdAt?.toDate ? 
                              new Date(review.createdAt.toDate()).toLocaleDateString(getDateLocale(), {
                                month: 'short',
                                day: 'numeric'
                              }) : ''}
                          </span>
                        </div>
                        <div className="flex gap-0.5 mb-2">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`w-4 h-4 ${
                                star <= review.rating
                                  ? 'text-yellow-400 fill-yellow-400'
                                  : 'text-white/30'
                              }`}
                            />
                          ))}
                        </div>
                        {review.comment && (
                          <p className="text-white/80 text-sm">{review.comment}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
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
    </div>
  );
}
