'use client';

import { X, Heart, Star, MapPin, Share2, Calendar, User, Send, CheckCircle, Shield, ImagePlus, Sparkles, Pencil, Trash2, Image as ImageIcon } from 'lucide-react';
import Image from 'next/image';
import type { Spot } from '@/store/useSpotStore';
import { useUserStore } from '@/store/useUserStore';
import { useLanguageStore } from '@/store/useLanguageStore';
import { useSpotStore, isAdmin as checkIsAdmin } from '@/store/useSpotStore';
import { useToastStore } from '@/store/useToastStore';
import { categoryEmojis, categoryTranslationKeys, getNavigationUrl } from '@/lib/spotUtils';
import { getLevelInfo, getUserNameColor } from '@/lib/levelUtils';
import { useState, useEffect, useRef, ChangeEvent, useCallback } from 'react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db, functions } from '@/lib/firebase';
import { httpsCallable } from 'firebase/functions';

interface SpotDetailsPanelProps {
  spot: Spot | null;
  isAdmin?: boolean;
  onClose: () => void;
}

export default function SpotDetailsPanel({ spot, isAdmin = false, onClose }: Readonly<SpotDetailsPanelProps>) {
  const { user, toggleFavorite } = useUserStore();
  const { language, t } = useLanguageStore();
  const { addReview, approveSpot, addSpotImages, migrateSpotImages, deleteSpot, updateSpotDescription, updateSpotName, deleteSpotImage, setPrimaryImage } = useSpotStore();
  const { showToast } = useToastStore();
  const [isFavorite, setIsFavorite] = useState(
    spot ? user?.savedSpots?.includes(spot.id) || false : false
  );
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isHighlighting, setIsHighlighting] = useState(false);
  const [isHighlightedByUser, setIsHighlightedByUser] = useState(false);
  const [userSpotsCount, setUserSpotsCount] = useState(0);
  const [creatorSpotsCount, setCreatorSpotsCount] = useState<number | null>(null);
  const [creatorName, setCreatorName] = useState<string | null>(null);
  const [creatorCustomNameColor, setCreatorCustomNameColor] = useState<string | undefined>();
  const [reviewerMeta, setReviewerMeta] = useState<Record<string, { spotsCount?: number; customNameColor?: string; username?: string }>>({});
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [uploaderNames, setUploaderNames] = useState<Record<string, string>>({});
  
  // Editing state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [showManageImages, setShowManageImages] = useState(false);
  
  // Fullscreen Gallery State
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  
  // Gallery swipe state
  const [galleryDragStartX, setGalleryDragStartX] = useState(0);
  const [galleryDragCurrentX, setGalleryDragCurrentX] = useState(0);
  const [isGalleryDragging, setIsGalleryDragging] = useState(false);
  
  // Swipe to Dismiss - Horizontal
  const [dragStartX, setDragStartX] = useState(0);
  const [dragCurrentX, setDragCurrentX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // Calculate gallery images early (safe for null spot) - Moved up to avoid conditional hooks
  const sortedSpotImages = (spot?.spotImages || [])
    .filter((image) => image.url !== '/placeholder-spot.jpg')
    .sort((a, b) => {
      if (b.likes !== a.likes) return b.likes - a.likes;
      return a.addedAt?.toMillis?.() && b.addedAt?.toMillis?.()
        ? b.addedAt.toMillis() - a.addedAt.toMillis()
        : 0;
    });

  const allGalleryImages = spot ? [
    ...sortedSpotImages.map(img => img.url),
    ...(spot.imageUrls || []).filter(url => !sortedSpotImages.some(img => img.url === url)),
  ].filter((url, index, self) => url !== '/placeholder-spot.jpg' && self.indexOf(url) === index) : [];

  // Gallery navigation callbacks - must be defined before any early returns
  const openGallery = useCallback((index: number) => {
    setGalleryIndex(index);
    setGalleryOpen(true);
  }, []);

  const nextImage = useCallback(() => {
    if (allGalleryImages.length === 0) return;
    setGalleryIndex((prev) => (prev + 1) % allGalleryImages.length);
  }, [allGalleryImages.length]);

  const prevImage = useCallback(() => {
    if (allGalleryImages.length === 0) return;
    setGalleryIndex((prev) => (prev - 1 + allGalleryImages.length) % allGalleryImages.length);
  }, [allGalleryImages.length]);

  // Keyboard navigation for gallery - must be defined before any early returns
  useEffect(() => {
    if (!galleryOpen) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') nextImage();
      if (e.key === 'ArrowLeft') prevImage();
      if (e.key === 'Escape') setGalleryOpen(false);
    };
    
    globalThis.addEventListener('keydown', handleKeyDown);
    return () => globalThis.removeEventListener('keydown', handleKeyDown);
  }, [galleryOpen, nextImage, prevImage]);

  // Fetch user's spots count for level calculation
  useEffect(() => {
    if (!user) return;
    
    const fetchUserSpotsCount = async () => {
      const spotsRef = collection(db, 'spots');
      const q = query(spotsRef, where('createdBy', '==', user.uid));
      const snapshot = await getDocs(q);
      setUserSpotsCount(snapshot.size);
    };
    
    fetchUserSpotsCount();
  }, [user]);

  useEffect(() => {
    if (!spot?.createdBy) return;
    let isMounted = true;

    const fetchCreatorInfo = async () => {
      try {
        const userRef = doc(db, 'users', spot.createdBy);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && isMounted) {
          const data = userSnap.data() as { username?: string; customNameColor?: string };
          setCreatorName(data.username || null);
          setCreatorCustomNameColor(data.customNameColor);
        }

        const spotsRef = collection(db, 'spots');
        const q = query(spotsRef, where('createdBy', '==', spot.createdBy));
        const snapshot = await getDocs(q);
        if (isMounted) {
          setCreatorSpotsCount(snapshot.size);
        }
      } catch (error) {
        console.error('Failed to fetch creator info:', error);
      }
    };

    if (spot.createdBy === user?.uid) {
      setCreatorName(user.username || null);
      setCreatorCustomNameColor(user.customNameColor);
      setCreatorSpotsCount(userSpotsCount);
      return;
    }

    fetchCreatorInfo();

    return () => {
      isMounted = false;
    };
  }, [spot?.createdBy, user?.uid, user?.username, user?.customNameColor, userSpotsCount]);

  // Check if user already highlighted this spot
  useEffect(() => {
    if (!spot || !user) {
      setIsHighlightedByUser(false);
      return;
    }

    const highlighted = spot.highlighted || [];
    const userHasHighlighted = highlighted.some((h: any) => h.userId === user.uid);
    setIsHighlightedByUser(userHasHighlighted);
  }, [spot, user]);

  useEffect(() => {
    if (!spot) return;
    if (!spot.spotImages || spot.spotImages.length === 0) {
      if (spot.imageUrls && spot.imageUrls.length > 0) {
        migrateSpotImages(spot.id).catch((error) => {
          console.error('Failed to migrate spot images:', error);
        });
      }
      return;
    }

    const missingUploaderIds = Array.from(
      new Set(
        spot.spotImages
          .map((image) => image.addedBy)
          .filter((id): id is string => Boolean(id))
          .filter((id) => !uploaderNames[id])
      )
    );

    if (missingUploaderIds.length === 0) return;

    let isMounted = true;
    const fetchUploaderNames = async () => {
      try {
        const results = await Promise.all(
          missingUploaderIds.map(async (userId) => {
            const userSnap = await getDoc(doc(db, 'users', userId));
            const data = userSnap.exists()
              ? (userSnap.data() as { username?: string })
              : undefined;
            return { userId, username: data?.username || t('anonymous') };
          })
        );

        if (!isMounted) return;
        setUploaderNames((prev) => {
          const next = { ...prev };
          results.forEach((result) => {
            next[result.userId] = result.username;
          });
          return next;
        });
      } catch (error) {
        console.error('Failed to fetch uploader names:', error);
      }
    };

    fetchUploaderNames();

    return () => {
      isMounted = false;
    };
  }, [spot, uploaderNames, migrateSpotImages, t]);

  useEffect(() => {
    if (!spot?.reviews || spot.reviews.length === 0) return;
    let isMounted = true;

    const missingUserIds = Array.from(
      new Set(
        spot.reviews
          .filter((review) => review.userId)
          .filter((review) => {
            const cached = reviewerMeta[review.userId];
            return (
              !cached ||
              review.userSpotsCount === undefined ||
              review.customNameColor === undefined ||
              !review.userName
            );
          })
          .map((review) => review.userId)
      )
    ).filter((userId) => !reviewerMeta[userId]);

    if (missingUserIds.length === 0) return;

    const fetchReviewerMeta = async () => {
      try {
        const results = await Promise.all(
          missingUserIds.map(async (userId) => {
            const [userSnap, spotsSnap] = await Promise.all([
              getDoc(doc(db, 'users', userId)),
              getDocs(query(collection(db, 'spots'), where('createdBy', '==', userId))),
            ]);

            const userData = userSnap.exists()
              ? (userSnap.data() as { username?: string; customNameColor?: string })
              : undefined;

            return {
              userId,
              username: userData?.username,
              customNameColor: userData?.customNameColor,
              spotsCount: spotsSnap.size,
            };
          })
        );

        if (!isMounted) return;
        setReviewerMeta((prev) => {
          const next = { ...prev };
          for (const result of results) {
            next[result.userId] = {
              username: result.username,
              customNameColor: result.customNameColor,
              spotsCount: result.spotsCount,
            };
          }
          return next;
        });
      } catch (error) {
        console.error('Failed to fetch reviewer meta:', error);
      }
    };

    fetchReviewerMeta();

    return () => {
      isMounted = false;
    };
  }, [spot?.reviews, reviewerMeta]);

  if (!spot) return null;

  const getDateLocale = () => {
    if (language === 'hu') return 'hu-HU';
    if (language === 'de') return 'de-DE';
    return 'en-US';
  };

  const handleFavoriteToggle = async () => {
    if (!user) return;
    try {
      await toggleFavorite(spot.id);
      setIsFavorite(!isFavorite);
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    }
  };

  const handleHighlightSpot = async () => {
    if (!user || !spot) return;

    // Check highlight bonus
    const highlightBonus = user?.questRewards?.valentine2026?.highlightBonus ?? 0;
    if (highlightBonus <= 0) {
      showToast(t('notEnoughHighlights'), 'error');
      return;
    }

    // Check if already highlighted by user
    if (isHighlightedByUser) {
      showToast(t('youHighlightedThis'), 'error');
      return;
    }

    setIsHighlighting(true);
    try {
      const highlightSpotFunction = httpsCallable(functions, 'highlightSpot');
      const result = await highlightSpotFunction({ spotId: spot.id });
      console.log('Highlight result:', result);
      
      showToast(t('highlightSuccess'), 'success');
      setIsHighlightedByUser(true);
      
      // Refresh user data to update highlight bonus
      // This would require a refetch from Firestore
    } catch (error: any) {
      console.error('Highlight error:', error);
      // Firebase callable functions put error details in different places
      const errorMessage = error?.details?.message || error?.message || error?.code || 'Error highlighting spot';
      showToast(errorMessage, 'error');
    } finally {
      setIsHighlighting(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!spot || !user) {
      showToast(t('mustBeLoggedIn'), 'error');
      return;
    }
    if (rating === 0) {
      showToast(t('ratingRequired'), 'error');
      return;
    }
    if (isSubmitting) return;

    // Check if user already reviewed this spot
    const alreadyReviewed = spot.reviews?.some(r => r.userId === user.uid);
    if (alreadyReviewed) {
      showToast('Már értékelted ezt a helyet!', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await addReview(spot.id, {
        userId: user.uid,
        userName: user.username || t('anonymous'),
        userEmail: user.email,
        userPhoto: user.profilePictureURL || user.photoURL,
        rating,
        comment,
        userSpotsCount,
        customNameColor: user.customNameColor,
        customNameFont: user.customNameFont,
      });
      showToast(t('reviewAdded'), 'success');
      setRating(0);
      setComment('');
    } catch (error) {
      console.error('Failed to submit review:', error);
      showToast(t('reviewError'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprove = async () => {
    if (!spot) return;
    setIsApproving(true);
    try {
      await approveSpot(spot.id);
      showToast(t('spotApproved'), 'success');
      setTimeout(() => onClose(), 1000);
    } catch (error) {
      console.error('Failed to approve spot:', error);
      showToast(t('approveError'), 'error');
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
          console.error('Share error:', err);
        }
      }
    }
  };

  const navigationUrl = getNavigationUrl(spot.location.lat, spot.location.lng);

  const handleAddPhotos = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    if (!user) {
      showToast(t('mustBeLoggedIn'), 'error');
      event.target.value = '';
      return;
    }

    setIsUploadingPhotos(true);
    try {
      await addSpotImages(spot.id, files, user.uid);
      showToast(t('spotPhotosAdded'), 'success');
    } catch (error: any) {
      const message =
        error?.message === 'MAX_SPOT_IMAGES'
          ? t('maxSpotImages')
          : error?.message || t('spotPhotoAddError');
      showToast(message, 'error');
    } finally {
      setIsUploadingPhotos(false);
      event.target.value = '';
    }
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

  // Can user edit this spot?
  const userIsAdmin = checkIsAdmin(user?.email);
  const isOwner = user && spot.createdBy === user.uid;
  const canEdit = userIsAdmin || (isOwner && spot.status === 'approved');

  const handleDeleteSpot = async () => {
    if (!confirm(t('confirmDeleteSpot'))) return;
    try {
      await deleteSpot(spot.id);
      showToast(t('spotDeleted'), 'success');
      onClose();
    } catch (error) {
      console.error('Failed to delete spot:', error);
      showToast(t('spotDeleteError'), 'error');
    }
  };

  const handleSaveEdit = async () => {
    try {
      if (editName.trim() && editName.trim() !== spot.name) {
        await updateSpotName(spot.id, editName.trim());
        showToast(t('nameUpdated'), 'success');
      }
      if (editDescription.trim() !== spot.description) {
        await updateSpotDescription(spot.id, editDescription.trim());
        showToast(t('descriptionUpdated'), 'success');
      }
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update spot:', error);
      showToast(t('updateError'), 'error');
    }
  };

  const handleSetPrimaryImage = async (index: number) => {
    try {
      await setPrimaryImage(spot.id, index);
      showToast(t('primaryImageSet'), 'success');
    } catch (error) {
      console.error('Failed to set primary image:', error);
      showToast(t('updateError'), 'error');
    }
  };

  const handleDeleteImage = async (imageUrl: string) => {
    if (!confirm(t('confirmDeleteSpot').replace('helyet', 'képet'))) return;
    try {
      await deleteSpotImage(spot.id, imageUrl);
      showToast(t('imageDeleted'), 'success');
    } catch (error) {
      console.error('Failed to delete image:', error);
      showToast(t('updateError'), 'error');
    }
  };

  const averageRating = spot.reviews && spot.reviews.length > 0
    ? spot.reviews.reduce((acc, r) => acc + r.rating, 0) / spot.reviews.length
    : 0;

  const heroImageUrl =
    spot.imageUrls?.[spot.primaryImageIndex || 0] ||
    spot.imageUrls?.[0] ||
    sortedSpotImages[0]?.url ||
    (spot as any).imageUrl ||
    '/placeholder-spot.jpg';

  const creatorDisplayName = creatorName || spot.createdByName || t('anonymous');
  const creatorNameColor = getUserNameColor(
    creatorSpotsCount ?? 0,
    creatorCustomNameColor
  );
  const creatorLevelInfo = getLevelInfo(creatorSpotsCount ?? 0);

  // Touch Handlers for Horizontal Swipe to Dismiss
  const handleTouchStart = (e: React.TouchEvent) => {
    setDragStartX(e.touches[0].clientX);
    setDragCurrentX(e.touches[0].clientX);
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const currentX = e.touches[0].clientX;
    
    // Allow both left and right drag
    setDragCurrentX(currentX);
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    const dragDistance = Math.abs(dragCurrentX - dragStartX);
    
    // Close if dragged more than 100px horizontally
    if (dragDistance > 100) {
      onClose();
    }
    
    // Reset
    setIsDragging(false);
    setDragStartX(0);
    setDragCurrentX(0);
  };

  const translateX = isDragging ? (dragCurrentX - dragStartX) : 0;

  return (
    <div className="fixed inset-0 z-[60] animate-slide-up" style={{ backgroundColor: '#0f172a' }}>
      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-xl cursor-default pointer-events-auto"
        onClick={onClose}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
        aria-label="Close spot details"
        tabIndex={-1}
      />
      
      {/* Panel - With Horizontal Swipe Support */}
      <div 
        className="absolute inset-0 flex flex-col bg-gradient-to-b from-slate-900 to-slate-800 pointer-events-none"
        style={{ 
          transform: `translateX(${translateX}px)`,
          transition: isDragging ? 'none' : 'transform 0.3s ease-out'
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        
        {/* Hero Image - Clickable to open gallery */}
        <div 
          className="relative w-full h-[40vh] flex-shrink-0 pointer-events-auto cursor-pointer"
          onClick={() => allGalleryImages.length > 0 && openGallery(0)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && allGalleryImages.length > 0 && openGallery(0)}
        >
          <Image
            src={heroImageUrl}
            alt={spot.name}
            fill
            sizes="100vw"
            className="object-cover"
            priority
            unoptimized={!spot.imageUrls && !(spot as any).imageUrl}
          />
          
          {/* Image count badge */}
          {allGalleryImages.length > 1 && (
            <div className="absolute bottom-4 right-4 bg-black/60 text-white text-sm px-3 py-1.5 rounded-full flex items-center gap-1">
              📸 {allGalleryImages.length}
            </div>
          )}
          
          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-slate-900/80" />
          
          {/* Action Buttons */}
          <div className="absolute left-4 right-4 flex justify-between items-center" style={{ top: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}>
            <button
              onClick={onClose}
              className="glass-button p-3 rounded-full touch-manipulation min-w-[48px] min-h-[48px]"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-white" />
            </button>
            
            <div className="flex gap-2">
              {user && (
                <button
                  onClick={handleFavoriteToggle}
                  className="glass-button p-3 rounded-full touch-manipulation min-w-[48px] min-h-[48px]"
                  aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                >
                  <Heart
                    className={`w-5 h-5 ${
                      isFavorite ? 'fill-red-500 text-red-500' : 'text-white'
                    }`}
                  />
                </button>
              )}

              {/* Highlight Button - Show if user has bonus and hasn't highlighted this spot */}
              {user && spot.createdBy === user.uid && (user?.questRewards?.valentine2026?.highlightBonus ?? 0) > 0 && (
                <button
                  onClick={handleHighlightSpot}
                  disabled={isHighlighting || isHighlightedByUser}
                  className={`glass-button p-3 rounded-full touch-manipulation min-w-[48px] min-h-[48px] transition-all ${
                    isHighlightedByUser
                      ? 'opacity-50 cursor-not-allowed'
                      : 'hover:bg-yellow-500/20 active:scale-95'
                  }`}
                  aria-label={t('highlightSpot')}
                  title={isHighlightedByUser ? t('youHighlightedThis') : t('highlightSpot')}
                >
                  <Sparkles
                    className={`w-5 h-5 ${
                      isHighlightedByUser ? 'text-yellow-500 fill-yellow-500' : 'text-white'
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
              <span className="text-white font-medium">{t(categoryTranslationKeys[spot.category])}</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-6 pt-6 pointer-events-auto" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)' }}>
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
                      {isApproving ? t('approving') : t('approve')}
                    </span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Title & Rating */}
          <div>
            <div className="flex items-center justify-between mb-2">
              {isEditing ? (
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="text-2xl font-bold text-white bg-white/10 border border-white/20 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 flex-1 mr-2"
                />
              ) : (
                <h1 className="text-3xl font-bold text-white flex items-center gap-2">
                  {spot.name}
                  {isHighlightedByUser && (
                    <span className="text-yellow-400 animate-pulse" title={t('spotHasHighlight')}>⭐</span>
                  )}
                </h1>
              )}
              {canEdit && !isEditing && (
                <button
                  onClick={() => { setEditName(spot.name); setEditDescription(spot.description); setIsEditing(true); }}
                  className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors flex-shrink-0"
                  aria-label={t('editSpot')}
                >
                  <Pencil className="w-4 h-4 text-white/70" />
                </button>
              )}
            </div>
            
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
                href={navigationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-400 text-sm font-medium mt-1 hover:underline inline-block"
              >
                {t('openInMaps')} →
              </a>
            </div>
          </div>

          {/* Description */}
          {isEditing ? (
            <div>
              <h2 className="text-xl font-bold text-white mb-3">{t('editDescription')}</h2>
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all resize-none"
                rows={4}
              />
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleSaveEdit}
                  className="flex-1 py-2.5 rounded-xl font-medium text-sm bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30 active:scale-98 transition-all flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  {t('save')}
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="flex-1 py-2.5 rounded-xl font-medium text-sm bg-white/10 text-white/70 border border-white/20 hover:bg-white/20 active:scale-98 transition-all"
                >
                  {t('cancel')}
                </button>
              </div>
            </div>
          ) : spot.description ? (
            <div>
              <h2 className="text-xl font-bold text-white mb-3">{t('description')}</h2>
              <p className="text-white/80 leading-relaxed">{spot.description}</p>
            </div>
          ) : null}

          {/* Manage Images - for owners & admins */}
          {canEdit && (
            <div>
              <button
                onClick={() => setShowManageImages(!showManageImages)}
                className="w-full glass-card p-4 flex items-center justify-between hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-primary-400" />
                  <span className="text-white font-medium">{t('manageImages')}</span>
                </div>
                <span className="text-white/40 text-sm">{allGalleryImages.length} 📸</span>
              </button>
              
              {showManageImages && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {(spot.imageUrls || []).filter(url => url !== '/placeholder-spot.jpg').map((url, index) => (
                    <div key={url} className="relative group rounded-xl overflow-hidden aspect-square">
                      <Image src={url} alt={`Image ${index + 1}`} fill sizes="120px" className="object-cover" />
                      {(spot.primaryImageIndex || 0) === index && (
                        <div className="absolute top-1 left-1 bg-primary-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                          ★
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                        <button
                          onClick={() => handleSetPrimaryImage(index)}
                          className="p-1.5 rounded-full bg-primary-500/80 text-white hover:bg-primary-500 transition-colors"
                          title={t('setPrimaryImage')}
                        >
                          <Star className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteImage(url)}
                          className="p-1.5 rounded-full bg-red-500/80 text-white hover:bg-red-500 transition-colors"
                          title={t('deleteImage')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Delete Spot - for admins */}
          {userIsAdmin && (
            <button
              onClick={handleDeleteSpot}
              className="w-full py-3 rounded-xl font-medium text-sm bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 active:scale-98 transition-all flex items-center justify-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              {t('deleteSpot')}
            </button>
          )}

          {/* Meta Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <p className="font-medium" style={{ color: creatorNameColor }}>
                  {creatorDisplayName}
                </p>
                <span className={`text-xs px-2 py-0.5 rounded-full border ${creatorLevelInfo.bgColor} ${creatorLevelInfo.borderColor} ${creatorLevelInfo.textColor}`}>
                  {creatorLevelInfo.icon} {creatorLevelInfo.level}
                </span>
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
                  {(user.profilePictureURL || user.photoURL) && (
                    <div className="relative w-10 h-10 rounded-full overflow-hidden">
                      <Image src={user.profilePictureURL || user.photoURL || ''} alt={user.username || 'User'} fill sizes="40px" className="object-cover" />
                    </div>
                  )}
                  <div>
                    <p className="text-white font-medium">{user.username}</p>
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
                  id="review-comment"
                  name="reviewComment"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={t('writeReview')}
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all resize-none"
                  rows={3}
                />
                
                <button
                  onClick={handleSubmitReview}
                  disabled={isSubmitting || rating === 0}
                  className="mt-3 w-full py-3 rounded-xl font-medium bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  <span>{isSubmitting ? t('submittingReview') : t('submitReview')}</span>
                </button>
              </div>
            )}

            {/* Add Photos */}
            <div className="glass-card p-4 mb-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-white font-medium">{t('addSpotPhotos')}</p>
                  <p className="text-white/50 text-xs">{t('maxSpotImages')}</p>
                </div>
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={isUploadingPhotos}
                  className="px-4 py-2 rounded-xl font-medium text-sm
                    bg-white/10 text-white border border-white/20
                    hover:bg-white/20 active:scale-98 transition-all duration-200
                    disabled:opacity-50 disabled:cursor-not-allowed
                    flex items-center gap-2"
                >
                  <ImagePlus className="w-4 h-4" />
                  <span>{isUploadingPhotos ? t('uploadingPhotos') : t('addPhotos')}</span>
                </button>
              </div>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleAddPhotos}
                className="hidden"
              />
            </div>

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
                          <Image src={review.userPhoto} alt={review.userName} fill sizes="40px" className="object-cover" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <p
                              className={`font-medium ${review.customNameFont || 'font-sans'}`}
                              style={{
                                color: getUserNameColor(
                                  review.userSpotsCount ?? reviewerMeta[review.userId]?.spotsCount ?? 0,
                                  review.customNameColor ?? reviewerMeta[review.userId]?.customNameColor
                                ),
                              }}
                            >
                              {reviewerMeta[review.userId]?.username || review.userName || t('anonymous')}
                            </p>
                            {(() => {
                              const reviewSpotsCount = review.userSpotsCount ?? reviewerMeta[review.userId]?.spotsCount ?? 0;
                              const reviewLevelInfo = getLevelInfo(reviewSpotsCount);
                              return (
                                <span className={`text-xs px-2 py-0.5 rounded-full border ${reviewLevelInfo.bgColor} ${reviewLevelInfo.borderColor} ${reviewLevelInfo.textColor}`}>
                                  {reviewLevelInfo.icon} {reviewLevelInfo.level}
                                </span>
                              );
                            })()}
                            {checkIsAdmin(review.userEmail) && (
                              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30">
                                <Shield className="w-3 h-3 text-amber-400" />
                                <span className="text-amber-400 text-xs font-bold">{t('adminCount')}</span>
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
            href={navigationUrl}
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

      {/* Fullscreen Gallery Modal - Mobile Swipe */}
      {galleryOpen && allGalleryImages.length > 0 && (
        <div 
          className="fixed inset-0 z-[100] bg-black"
          onTouchStart={(e) => {
            setGalleryDragStartX(e.touches[0].clientX);
            setGalleryDragCurrentX(e.touches[0].clientX);
            setIsGalleryDragging(true);
          }}
          onTouchMove={(e) => {
            if (!isGalleryDragging) return;
            setGalleryDragCurrentX(e.touches[0].clientX);
          }}
          onTouchEnd={() => {
            if (!isGalleryDragging) return;
            const dragDistance = galleryDragCurrentX - galleryDragStartX;
            const threshold = 50;
            
            if (dragDistance > threshold && allGalleryImages.length > 1) {
              // Swiped right - previous image
              prevImage();
            } else if (dragDistance < -threshold && allGalleryImages.length > 1) {
              // Swiped left - next image
              nextImage();
            }
            
            setIsGalleryDragging(false);
            setGalleryDragStartX(0);
            setGalleryDragCurrentX(0);
          }}
        >
          {/* Close button */}
          <button
            onClick={() => setGalleryOpen(false)}
            className="absolute top-4 right-4 z-20 p-3 rounded-full bg-black/50 active:bg-black/70 transition-colors touch-manipulation"
            style={{ top: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}
          >
            <X className="w-6 h-6 text-white" />
          </button>

          {/* Image counter */}
          {allGalleryImages.length > 1 && (
            <div 
              className="absolute top-4 left-4 z-20 text-white text-sm bg-black/50 px-3 py-1.5 rounded-full"
              style={{ top: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}
            >
              {galleryIndex + 1} / {allGalleryImages.length}
            </div>
          )}

          {/* Image with swipe transform */}
          <div 
            className="absolute inset-0 flex items-center justify-center"
            style={{
              transform: isGalleryDragging 
                ? `translateX(${galleryDragCurrentX - galleryDragStartX}px)` 
                : 'translateX(0)',
              transition: isGalleryDragging ? 'none' : 'transform 0.2s ease-out',
            }}
          >
            <Image
              src={allGalleryImages[galleryIndex]}
              alt={`${spot.name} - Image ${galleryIndex + 1}`}
              fill
              sizes="100vw"
              className="object-contain"
              priority
              draggable={false}
            />
          </div>

          {/* Dot indicators at bottom */}
          {allGalleryImages.length > 1 && (
            <div 
              className="absolute bottom-8 left-0 right-0 flex justify-center gap-2 z-20"
              style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
            >
              {allGalleryImages.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setGalleryIndex(index)}
                  className={`w-2 h-2 rounded-full transition-all touch-manipulation ${
                    index === galleryIndex 
                      ? 'bg-white w-6' 
                      : 'bg-white/40'
                  }`}
                  aria-label={`Go to image ${index + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
