'use client';

import { X, Heart, Star, MapPin, Share2, Calendar, User, Send, CheckCircle, Shield, ImagePlus, Sparkles, Pencil, Trash2, Image as ImageIcon } from 'lucide-react';
import Image from 'next/image';
import type { Review, Spot } from '@/store/useSpotStore';
import { useUserStore } from '@/store/useUserStore';
import { useLanguageStore } from '@/store/useLanguageStore';
import { useSpotStore } from '@/store/useSpotStore';
import { fetchPublicProfile, fetchPublicProfiles } from '@/store/publicProfiles';
import { useToastStore } from '@/store/useToastStore';
import { categoryEmojis, categoryTranslationKeys, getNavigationUrl } from '@/lib/spotUtils';
import { getLevelInfo, getUserNameColor } from '@/lib/levelUtils';
import { resolveNameFontClass } from '@/lib/nameStyle';
import {
  PLACEHOLDER_URL,
  getGalleryUrls,
  getHeroImageUrl,
  getSpotImages,
  isImageUnoptimized,
  sortSpotImagesByLikes,
} from '@/lib/spotImages';
import { averageRating } from '@/lib/rating';
import { DELAYS, SWIPE_THRESHOLDS } from '@/lib/constants';
import { isHighlightedBy } from '@/lib/highlights';
import { useState, useEffect, useRef, ChangeEvent, useCallback } from 'react';

interface SpotDetailsPanelProps {
  spot: Spot | null;
  isAdmin?: boolean;
  onClose: () => void;
}

interface SwipeState {
  startX: number;
  currentX: number;
  dragging: boolean;
}

const SWIPE_INITIAL: SwipeState = { startX: 0, currentX: 0, dragging: false };

function useSwipeDismiss(onDismiss: () => void, threshold: number = SWIPE_THRESHOLDS.spotDetails) {
  const [swipe, setSwipe] = useState<SwipeState>(SWIPE_INITIAL);

  const onTouchStart = (e: React.TouchEvent) => {
    const x = e.touches[0].clientX;
    setSwipe({ startX: x, currentX: x, dragging: true });
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!swipe.dragging) return;
    setSwipe((s) => ({ ...s, currentX: e.touches[0].clientX }));
  };
  const onTouchEnd = () => {
    if (!swipe.dragging) return;
    if (Math.abs(swipe.currentX - swipe.startX) > threshold) onDismiss();
    setSwipe(SWIPE_INITIAL);
  };

  return { swipe, onTouchStart, onTouchMove, onTouchEnd };
}

function StarRow({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'md' }) {
  const cls = size === 'md' ? 'w-5 h-5' : 'w-4 h-4';
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`${cls} ${star <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-white/30'}`}
        />
      ))}
    </div>
  );
}

interface ReviewerMeta {
  username?: string;
  spotsCount?: number;
  customNameColor?: string;
  customNameFont?: string;
  isAdmin?: boolean;
}

// Display style comes only from the reviewer's public profile; the review's own legacy
// style/level fields are spoofable and never read (SEC-05).
function ReviewerBadge({ meta, review }: { meta: ReviewerMeta; review: Review }) {
  const spotsCount = meta.spotsCount ?? 0;
  const levelInfo = getLevelInfo(spotsCount);
  const nameColor = getUserNameColor(spotsCount, meta.customNameColor ?? undefined);
  const fontClass = resolveNameFontClass(meta.customNameFont);
  return (
    <div className="flex items-center gap-2">
      <p
        className={`font-medium ${fontClass}`}
        style={{ color: nameColor }}
      >
        {meta.username || review.userName}
      </p>
      <span className={`text-xs px-2 py-0.5 rounded-full border ${levelInfo.bgColor} ${levelInfo.borderColor} ${levelInfo.textColor}`}>
        {levelInfo.icon} {levelInfo.level}
      </span>
      {meta.isAdmin === true && (
        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30">
          <Shield className="w-3 h-3 text-amber-400" />
          <span className="text-amber-400 text-xs font-bold">Admin</span>
        </div>
      )}
    </div>
  );
}

export default function SpotDetailsPanel({ spot, isAdmin = false, onClose }: Readonly<SpotDetailsPanelProps>) {
  const { user, toggleFavorite, highlightSpot } = useUserStore();
  const userIsAdmin = useUserStore((s) => s.isAdmin);
  const { language, t } = useLanguageStore();
  const { addReview, approveSpot, addSpotImages, deleteSpot, updateSpotDescription, updateSpotName, deleteSpotImage, setPrimaryImage } = useSpotStore();
  const { showToast } = useToastStore();

  // Review form state
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Action state
  const [isFavorite, setIsFavorite] = useState(spot ? user?.savedSpots?.includes(spot.id) || false : false);
  const [isApproving, setIsApproving] = useState(false);
  const [isHighlighting, setIsHighlighting] = useState(false);
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);

  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [showManageImages, setShowManageImages] = useState(false);

  // Gallery state
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [ignoreHeroClicks, setIgnoreHeroClicks] = useState(true);

  // User/creator metadata
  const [creatorSpotsCount, setCreatorSpotsCount] = useState<number | null>(null);
  const [creatorName, setCreatorName] = useState<string | null>(null);
  const [creatorCustomNameColor, setCreatorCustomNameColor] = useState<string | undefined>();
  const [reviewerMeta, setReviewerMeta] = useState<Record<string, ReviewerMeta>>({});

  const photoInputRef = useRef<HTMLInputElement>(null);
  const approveCloseTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const shownSpotIdRef = useRef<string | undefined>(undefined);

  // Swipe to dismiss the panel
  const { swipe: panelSwipe, onTouchStart, onTouchMove, onTouchEnd } = useSwipeDismiss(onClose);

  // Gallery swipe (separate because threshold/behavior differs)
  const [gallerySwipe, setGallerySwipe] = useState<SwipeState>(SWIPE_INITIAL);

  // Live store copy of the open spot (the `spot` prop is a snapshot, see T29). Used only for the
  // highlight and gallery derivations.
  const fresh = useSpotStore((s) => (spot ? s.spots.find((x) => x.id === spot.id) : undefined)) ?? spot;

  // Sorted gallery images (stable across renders, safe before null-check). Legacy spots are
  // materialised in memory only (never written on read).
  const sortedSpotImages = sortSpotImagesByLikes(fresh ? getSpotImages(fresh) : [], 'missingAsZero');

  const allGalleryImages = fresh ? getGalleryUrls(fresh, sortedSpotImages) : [];

  const isHighlightedByUser = !!fresh && !!user && isHighlightedBy(fresh, user.uid);

  // A primitive dependency: the React Compiler cannot prove the helper-built array is not mutated.
  const galleryCount = allGalleryImages.length;

  const nextImage = useCallback(() => {
    setGalleryIndex((prev) => (prev + 1) % galleryCount);
  }, [galleryCount]);

  const prevImage = useCallback(() => {
    setGalleryIndex((prev) => (prev - 1 + galleryCount) % galleryCount);
  }, [galleryCount]);

  // Ignore hero clicks briefly when panel opens (prevents accidental gallery open)
  useEffect(() => {
    setIgnoreHeroClicks(true);
    const id = setTimeout(() => setIgnoreHeroClicks(false), DELAYS.heroClickGuard);
    return () => clearTimeout(id);
  }, [spot?.id]);

  // Cancel a pending close-after-approve when the shown spot changes (the component never unmounts)
  useEffect(() => {
    shownSpotIdRef.current = spot?.id;
    return () => clearTimeout(approveCloseTimerRef.current);
  }, [spot?.id]);

  // Keyboard navigation for gallery
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

  // Fetch creator info (public profile mirror)
  useEffect(() => {
    if (!spot?.createdBy) return;

    const isSelf = spot.createdBy === user?.uid;
    if (isSelf) {
      setCreatorName(user.username || null);
      setCreatorCustomNameColor(user.customNameColor);
    }

    let isMounted = true;
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
    return () => { isMounted = false; };
  }, [spot?.createdBy, user?.uid, user?.username, user?.customNameColor]);

  // Fetch reviewer display metadata
  useEffect(() => {
    if (!spot?.reviews?.length) return;

    const missingIds = [...new Set(
      spot.reviews
        .filter((r) => r.userId && !reviewerMeta[r.userId])
        .map((r) => r.userId)
    )];
    if (!missingIds.length) return;

    let isMounted = true;
    fetchPublicProfiles(missingIds).then((profiles) => {
      if (!isMounted) return;
      setReviewerMeta((prev) => ({
        ...prev,
        ...Object.fromEntries(missingIds.map((uid) => {
          const p = profiles[uid];
          return [uid, {
            username: p?.username ?? undefined,
            customNameColor: p?.customNameColor ?? undefined,
            customNameFont: p?.customNameFont ?? undefined,
            spotsCount: p?.spotsCount,
            isAdmin: p?.isAdmin,
          }];
        })),
      }));
    }).catch(console.error);

    return () => { isMounted = false; };
  }, [spot?.reviews, reviewerMeta]);

  if (!spot) return null;

  const getDateLocale = () => language === 'hu' ? 'hu-HU' : language === 'de' ? 'de-DE' : 'en-US';

  const formatDate = (timestamp: any) => {
    if (!timestamp) return t('unknownDate');
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString(getDateLocale(), { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const isOwner = user && spot.createdBy === user.uid;
  const canEdit = userIsAdmin || (isOwner && spot.status === 'approved');
  const navigationUrl = getNavigationUrl(spot.location.lat, spot.location.lng);
  const avgRating = averageRating(spot.reviews);
  // Manager tiles: imageUrls entries keep their original index (primaryImageIndex indexes imageUrls);
  // images only in spotImages have no index, so they can be deleted but not made primary.
  const imageUrlSet = new Set(spot.imageUrls || []);
  const managedImages: Array<{ url: string; index?: number }> = [
    ...(spot.imageUrls || []).map((url, index) => ({ url, index })).filter((e) => e.url !== PLACEHOLDER_URL),
    ...getSpotImages(spot)
      .map((img) => img.url)
      .filter((url, i, self) => url !== PLACEHOLDER_URL && !imageUrlSet.has(url) && self.indexOf(url) === i)
      .map((url) => ({ url })),
  ];
  const heroImageUrl = getHeroImageUrl(spot, sortedSpotImages);
  const creatorDisplayName = creatorName || spot.createdByName || t('anonymous');
  const creatorNameColor = getUserNameColor(creatorSpotsCount ?? 0, creatorCustomNameColor);
  const creatorLevelInfo = getLevelInfo(creatorSpotsCount ?? 0);

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
    if (!user || isHighlightedByUser) {
      if (isHighlightedByUser) showToast(t('youHighlightedThis'), 'error');
      return;
    }
    setIsHighlighting(true);
    try {
      await highlightSpot(spot.id);
      showToast(t('highlightSuccess'), 'success');
    } catch (error: any) {
      showToast(error?.details?.message || error?.message || t('highlightError'), 'error');
    } finally {
      setIsHighlighting(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!user) { showToast(t('mustBeLoggedIn'), 'error'); return; }
    if (rating === 0) { showToast(t('ratingRequired'), 'error'); return; }
    if (isSubmitting) return;
    if (spot.reviews?.some((r) => r.userId === user.uid)) {
      showToast(t('alreadyReviewed'), 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await addReview(spot.id, {
        userId: user.uid,
        userName: user.username || t('anonymous'),
        userPhoto: user.profilePictureURL || user.photoURL,
        rating,
        comment,
      });
      showToast(t('reviewAdded'), 'success');
      setRating(0);
      setComment('');
    } catch (error) {
      showToast(t('reviewError'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      const approvedId = spot.id;
      await approveSpot(approvedId);
      showToast(t('spotApproved'), 'success');
      // Another spot may have been opened while the write was pending: only close the approved one.
      if (shownSpotIdRef.current === approvedId) {
        approveCloseTimerRef.current = setTimeout(() => onClose(), DELAYS.approveClose);
      }
    } catch (error) {
      showToast(t('approveError'), 'error');
    } finally {
      setIsApproving(false);
    }
  };

  const handleShare = async () => {
    if (!navigator.share) return;
    try {
      await navigator.share({ title: spot.name, text: spot.description, url: globalThis.location.href });
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') console.error('Share error:', err);
    }
  };

  const handleAddPhotos = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    if (!user) { showToast(t('mustBeLoggedIn'), 'error'); event.target.value = ''; return; }

    setIsUploadingPhotos(true);
    try {
      await addSpotImages(spot.id, files, user.uid);
      showToast(t('spotPhotosAdded'), 'success');
    } catch (error) {
      console.error('Failed to add photos:', error);
      showToast(error instanceof Error && error.message === 'MAX_SPOT_IMAGES' ? t('maxSpotImages') : t('spotPhotoAddError'), 'error');
    } finally {
      setIsUploadingPhotos(false);
      event.target.value = '';
    }
  };

  const handleSaveEdit = async () => {
    try {
      const nameChanged = !!editName.trim() && editName.trim() !== spot.name;
      const descChanged = editDescription.trim() !== spot.description;
      if (nameChanged) await updateSpotName(spot.id, editName.trim());
      if (descChanged) await updateSpotDescription(spot.id, editDescription.trim());
      setIsEditing(false);
      if (nameChanged && descChanged) showToast(t('spotUpdated'), 'success');
      else if (nameChanged) showToast(t('nameUpdated'), 'success');
      else if (descChanged) showToast(t('descriptionUpdated'), 'success');
    } catch (error) {
      showToast(t('updateError'), 'error');
    }
  };

  const handleSetPrimaryImage = async (index: number) => {
    try {
      await setPrimaryImage(spot.id, index);
      showToast(t('primaryImageSet'), 'success');
    } catch (error) {
      showToast(t('updateError'), 'error');
    }
  };

  const handleDeleteImage = async (imageUrl: string) => {
    if (!confirm(t('confirmDeleteImage'))) return;
    try {
      await deleteSpotImage(spot.id, imageUrl);
      showToast(t('imageDeleted'), 'success');
    } catch (error) {
      showToast(t('updateError'), 'error');
    }
  };

  const handleDeleteSpot = async () => {
    if (!confirm(t('confirmDeleteSpot'))) return;
    try {
      await deleteSpot(spot.id);
      showToast(t('spotDeleted'), 'success');
      onClose();
    } catch (error) {
      showToast(t('spotDeleteError'), 'error');
    }
  };

  const panelTranslateX = panelSwipe.dragging ? panelSwipe.currentX - panelSwipe.startX : 0;

  return (
    <div className="fixed inset-0 z-[60] animate-slide-up" style={{ backgroundColor: '#0f172a' }}>
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-xl cursor-default pointer-events-auto"
        onClick={onClose}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
        aria-label="Close spot details"
        tabIndex={-1}
      />

      <div
        className="absolute inset-0 flex flex-col bg-gradient-to-b from-slate-900 to-slate-800 pointer-events-none"
        style={{ transform: `translateX(${panelTranslateX}px)`, transition: panelSwipe.dragging ? 'none' : 'transform 0.3s ease-out' }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Hero Image */}
        <div
          className="relative w-full h-[40vh] flex-shrink-0 pointer-events-auto cursor-pointer"
          onClick={() => !ignoreHeroClicks && allGalleryImages.length > 0 && (setGalleryIndex(0), setGalleryOpen(true))}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => !ignoreHeroClicks && e.key === 'Enter' && allGalleryImages.length > 0 && (setGalleryIndex(0), setGalleryOpen(true))}
        >
          <Image src={heroImageUrl} alt={spot.name} fill sizes="100vw" className="object-cover" priority unoptimized={isImageUnoptimized(spot)} />
          {allGalleryImages.length > 1 && (
            <div className="absolute bottom-4 right-4 bg-black/60 text-white text-sm px-3 py-1.5 rounded-full flex items-center gap-1">
              📸 {allGalleryImages.length}
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-slate-900/80" />

          {/* Top action bar */}
          <div className="absolute left-4 right-4 flex justify-between items-center" style={{ top: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}>
            <button onClick={onClose} className="glass-button p-3 rounded-full touch-manipulation min-w-[48px] min-h-[48px]" aria-label="Close">
              <X className="w-5 h-5 text-white" />
            </button>
            <div className="flex gap-2">
              {user && (
                <button onClick={handleFavoriteToggle} className="glass-button p-3 rounded-full touch-manipulation min-w-[48px] min-h-[48px]" aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}>
                  <Heart className={`w-5 h-5 ${isFavorite ? 'fill-red-500 text-red-500' : 'text-white'}`} />
                </button>
              )}
              {user && spot.createdBy === user.uid && (
                <button
                  onClick={handleHighlightSpot}
                  disabled={isHighlighting || isHighlightedByUser}
                  className={`glass-button p-3 rounded-full touch-manipulation min-w-[48px] min-h-[48px] transition-all ${isHighlightedByUser ? 'opacity-50 cursor-not-allowed' : 'hover:bg-yellow-500/20 active:scale-95'}`}
                  aria-label={t('highlightSpot')}
                  title={isHighlightedByUser ? t('youHighlightedThis') : t('highlightSpot')}
                >
                  <Sparkles className={`w-5 h-5 ${isHighlightedByUser ? 'text-yellow-500 fill-yellow-500' : 'text-white'}`} />
                </button>
              )}
              <button onClick={handleShare} className="glass-button p-3 rounded-full" aria-label="Share">
                <Share2 className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>

          {/* Category badge */}
          <div className="absolute bottom-4 left-4">
            <div className="glass-card px-4 py-2 flex items-center gap-2">
              <span className="text-2xl">{categoryEmojis[spot.category]}</span>
              <span className="text-white font-medium">{t(categoryTranslationKeys[spot.category])}</span>
            </div>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-6 pt-6 pointer-events-auto" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)' }}>
          <div className="space-y-6">

            {/* Admin status & approve */}
            {isAdmin && (
              <div className="glass-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className={`text-xs px-3 py-1 rounded-full font-medium ${spot.status === 'approved' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                    {spot.status === 'approved' ? t('approved') : t('pending')}
                  </span>
                  {spot.status === 'pending' && (
                    <button
                      onClick={handleApprove}
                      disabled={isApproving}
                      className="px-4 py-2 rounded-xl font-medium bg-gradient-to-r from-green-500 to-green-600 text-white text-sm shadow-lg shadow-green-500/20 hover:shadow-xl active:scale-98 transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                      <CheckCircle className="w-4 h-4" />
                      {isApproving ? t('approving') : t('approve')}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Title & rating */}
            <div>
              <div className="flex items-center justify-between mb-2">
                {isEditing ? (
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    maxLength={100}
                    className="text-2xl font-bold text-white bg-white/10 border border-white/20 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 flex-1 mr-2"
                  />
                ) : (
                  <h1 className="text-3xl font-bold text-white flex items-center gap-2">
                    {spot.name}
                    {isHighlightedByUser && <span className="text-yellow-400 animate-pulse" title={t('spotHasHighlight')}>⭐</span>}
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
                <StarRow rating={Math.round(avgRating)} size="md" />
                <span className="text-white font-semibold">{avgRating > 0 ? avgRating.toFixed(1) : '-'}</span>
                <span className="text-white/60">({spot.reviews?.length || 0} {t('reviews')})</span>
              </div>
            </div>

            {/* Location */}
            <div className="glass-card p-4 flex items-start gap-3">
              <MapPin className="w-5 h-5 text-primary-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-white/80 text-sm">{spot.location.lat.toFixed(6)}, {spot.location.lng.toFixed(6)}</p>
                <a href={navigationUrl} target="_blank" rel="noopener noreferrer" className="text-primary-400 text-sm font-medium mt-1 hover:underline inline-block">
                  {t('openInMaps')} →
                </a>
              </div>
            </div>

            {/* Description / Edit form */}
            {isEditing ? (
              <div>
                <h2 className="text-xl font-bold text-white mb-3">{t('editDescription')}</h2>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  maxLength={2000}
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all resize-none"
                  rows={4}
                />
                <div className="flex gap-2 mt-3">
                  <button onClick={handleSaveEdit} className="flex-1 py-2.5 rounded-xl font-medium text-sm bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30 active:scale-98 transition-all flex items-center justify-center gap-2">
                    <CheckCircle className="w-4 h-4" /> {t('save')}
                  </button>
                  <button onClick={() => setIsEditing(false)} className="flex-1 py-2.5 rounded-xl font-medium text-sm bg-white/10 text-white/70 border border-white/20 hover:bg-white/20 active:scale-98 transition-all">
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

            {/* Manage images (owner/admin) */}
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
                    {managedImages.map(({ url, index }, position) => (
                      <div key={url} className="relative group rounded-xl overflow-hidden aspect-square">
                        <Image src={url} alt={`Image ${position + 1}`} fill sizes="120px" className="object-cover" />
                        {index !== undefined && (spot.primaryImageIndex || 0) === index && (
                          <div className="absolute top-1 left-1 bg-primary-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">★</div>
                        )}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                          {index !== undefined && (
                            <button onClick={() => handleSetPrimaryImage(index)} className="p-1.5 rounded-full bg-primary-500/80 text-white hover:bg-primary-500 transition-colors" title={t('setPrimaryImage')}>
                              <Star className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button onClick={() => handleDeleteImage(url)} className="p-1.5 rounded-full bg-red-500/80 text-white hover:bg-red-500 transition-colors" title={t('deleteImage')}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Delete spot (admin only) */}
            {userIsAdmin && (
              <button
                onClick={handleDeleteSpot}
                className="w-full py-3 rounded-xl font-medium text-sm bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 active:scale-98 transition-all flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" /> {t('deleteSpot')}
              </button>
            )}

            {/* Meta info */}
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
                  <p className="font-medium" style={{ color: creatorNameColor }}>{creatorDisplayName}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${creatorLevelInfo.bgColor} ${creatorLevelInfo.borderColor} ${creatorLevelInfo.textColor}`}>
                    {creatorLevelInfo.icon} {creatorLevelInfo.level}
                  </span>
                </div>
              </div>
            </div>

            {/* Reviews section */}
            <div>
              <h2 className="text-xl font-bold text-white mb-4">{t('reviews')}</h2>

              {/* Add review form */}
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
                          <button key={star} onClick={() => setRating(star)} className="transition-all duration-200 active:scale-95">
                            <Star className={`w-5 h-5 ${star <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-white/30'}`} />
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
                    maxLength={1000}
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all resize-none"
                    rows={3}
                  />
                  <button
                    onClick={handleSubmitReview}
                    disabled={isSubmitting || rating === 0}
                    className="mt-3 w-full py-3 rounded-xl font-medium bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    {isSubmitting ? t('submittingReview') : t('submitReview')}
                  </button>
                </div>
              )}

              {/* Add photos */}
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
                    className="px-4 py-2 rounded-xl font-medium text-sm bg-white/10 text-white border border-white/20 hover:bg-white/20 active:scale-98 transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    <ImagePlus className="w-4 h-4" />
                    {isUploadingPhotos ? t('uploadingPhotos') : t('addPhotos')}
                  </button>
                </div>
                <input ref={photoInputRef} type="file" accept="image/*" multiple onChange={handleAddPhotos} className="hidden" />
              </div>

              {/* Reviews list */}
              <div className="space-y-3">
                {!spot.reviews?.length ? (
                  <div className="glass-card p-6 text-center">
                    <Star className="w-12 h-12 text-white/40 mx-auto mb-3" />
                    <p className="text-white/60">{t('noReviews')}</p>
                    <p className="text-white/40 text-sm mt-1">{t('beFirstToReview')}</p>
                  </div>
                ) : (
                  spot.reviews.map((review) => {
                    const meta = reviewerMeta[review.userId] ?? {};
                    return (
                      <div key={review.id} className="glass-card p-4">
                        <div className="flex items-start gap-3">
                          {review.userPhoto && (
                            <div className="relative w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
                              <Image src={review.userPhoto} alt={review.userName} fill sizes="40px" className="object-cover" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <ReviewerBadge meta={meta} review={review} />
                              <span className="text-white/40 text-xs">
                                {review.createdAt?.toDate
                                  ? new Date(review.createdAt.toDate()).toLocaleDateString(getDateLocale(), { month: 'short', day: 'numeric' })
                                  : ''}
                              </span>
                            </div>
                            <StarRow rating={review.rating} />
                            {review.comment && <p className="text-white/80 text-sm mt-2">{review.comment}</p>}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* CTA */}
            <a
              href={navigationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-4 rounded-2xl font-semibold text-lg bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg shadow-primary-500/30 hover:shadow-xl active:scale-98 transition-all flex items-center justify-center gap-2"
            >
              <MapPin className="w-5 h-5" /> {t('getDirections')}
            </a>

            <div className="h-20" />
          </div>
        </div>
      </div>

      {/* Fullscreen gallery modal */}
      {galleryOpen && allGalleryImages.length > 0 && (
        <div
          className="fixed inset-0 z-[100] bg-black"
          onTouchStart={(e) => { const x = e.touches[0].clientX; setGallerySwipe({ startX: x, currentX: x, dragging: true }); }}
          onTouchMove={(e) => { if (!gallerySwipe.dragging) return; setGallerySwipe((s) => ({ ...s, currentX: e.touches[0].clientX })); }}
          onTouchEnd={() => {
            if (!gallerySwipe.dragging) return;
            const dist = gallerySwipe.currentX - gallerySwipe.startX;
            if (dist > SWIPE_THRESHOLDS.gallery && allGalleryImages.length > 1) prevImage();
            else if (dist < -SWIPE_THRESHOLDS.gallery && allGalleryImages.length > 1) nextImage();
            setGallerySwipe(SWIPE_INITIAL);
          }}
        >
          <button
            onClick={() => setGalleryOpen(false)}
            className="absolute z-20 p-3 rounded-full bg-black/50 active:bg-black/70 transition-colors touch-manipulation"
            style={{ top: 'calc(env(safe-area-inset-top, 0px) + 1rem)', right: '1rem' }}
          >
            <X className="w-6 h-6 text-white" />
          </button>

          {allGalleryImages.length > 1 && (
            <div
              className="absolute z-20 text-white text-sm bg-black/50 px-3 py-1.5 rounded-full"
              style={{ top: 'calc(env(safe-area-inset-top, 0px) + 1rem)', left: '1rem' }}
            >
              {galleryIndex + 1} / {allGalleryImages.length}
            </div>
          )}

          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{
              transform: gallerySwipe.dragging ? `translateX(${gallerySwipe.currentX - gallerySwipe.startX}px)` : 'translateX(0)',
              transition: gallerySwipe.dragging ? 'none' : 'transform 0.2s ease-out',
            }}
          >
            <Image src={allGalleryImages[galleryIndex]} alt={`${spot.name} - Image ${galleryIndex + 1}`} fill sizes="100vw" className="object-contain" priority draggable={false} />
          </div>

          {allGalleryImages.length > 1 && (
            <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-2 z-20" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
              {allGalleryImages.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setGalleryIndex(index)}
                  className={`h-2 rounded-full transition-all touch-manipulation ${index === galleryIndex ? 'bg-white w-6' : 'bg-white/40 w-2'}`}
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
