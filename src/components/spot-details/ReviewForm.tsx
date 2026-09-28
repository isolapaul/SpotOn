'use client';

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import Image from 'next/image';
import { ImagePlus, Send, X } from 'lucide-react';
import type { Spot } from '@/store/useSpotStore';
import { useToastStore } from '@/store/useToastStore';
import { isSpotUploadRunning, useUploadStore } from '@/store/useUploadStore';
import { useT } from '@/hooks/useT';
import type { User } from '@/lib/mapUserDoc';
import { MAX_SPOT_IMAGES, realImageCount } from '@/lib/spotImages';
import StarRating from '../ui/StarRating';

interface ReviewFormProps {
  spot: Spot;
  user: User;
}

/**
 * The signed-in user's review form: star rating, comment, optional photos and one submit (one
 * review per user). Review and photos go up together in the background (G4); photos alone are
 * fine too (no rating needed then).
 */
export default function ReviewForm({ spot, user }: Readonly<ReviewFormProps>) {
  const submitReview = useUploadStore((s) => s.submitReview);
  const isUploading = useUploadStore((s) => isSpotUploadRunning(s.jobs, spot.id));
  const showToast = useToastStore((s) => s.showToast);
  const t = useT();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  // Picked photos with their object-URL previews (same order; revoked when dropped).
  const [photos, setPhotos] = useState<Array<{ file: File; preview: string }>>([]);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const files = photos.map((p) => p.file);

  // Free the previews on unmount (the latest list, via a ref updated after each render).
  const photosRef = useRef(photos);
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);
  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.preview)), []);

  const handlePickPhotos = (event: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files || []);
    event.target.value = '';
    if (!picked.length) return;
    if (realImageCount(spot) + files.length + picked.length > MAX_SPOT_IMAGES) {
      showToast(t('maxSpotImages'), 'error');
      return;
    }
    setPhotos((prev) => [...prev, ...picked.map((file) => ({ file, preview: URL.createObjectURL(file) }))]);
  };

  const removePhoto = (preview: string) => {
    URL.revokeObjectURL(preview);
    setPhotos((prev) => prev.filter((p) => p.preview !== preview));
  };

  const handleSubmit = () => {
    if (isUploading) return;
    const hasReview = rating > 0;
    // A comment needs a rating; photos alone do not.
    if (!hasReview && (comment.trim() !== '' || files.length === 0)) {
      showToast(t('ratingRequired'), 'error');
      return;
    }
    if (hasReview && spot.reviews?.some((r) => r.userId === user.uid)) {
      showToast(t('alreadyReviewed'), 'error');
      return;
    }

    // BUG-25: no local append; the spots listener delivers the new review and photos (T29).
    submitReview({
      spotId: spot.id,
      spotName: spot.name,
      review: hasReview
        ? {
            userId: user.uid,
            userName: user.username || t('anonymous'),
            userPhoto: user.profilePictureURL || user.photoURL,
            rating,
            comment,
          }
        : null,
      files,
      userId: user.uid,
    });
    setRating(0);
    setComment('');
    photos.forEach((p) => URL.revokeObjectURL(p.preview));
    setPhotos([]);
  };

  return (
    <div className="glass-card p-4 mb-4">
      <div className="flex items-center gap-3 mb-3">
        {(user.profilePictureURL || user.photoURL) && (
          <div className="relative w-10 h-10 rounded-full overflow-hidden">
            <Image src={user.profilePictureURL || user.photoURL || ''} alt={user.username || 'User'} fill sizes="40px" className="object-cover" />
          </div>
        )}
        <div>
          <p className="text-white font-medium">{user.username}</p>
          <StarRating rating={rating} size="md" emptyTone="dim" gap="gap-1" onSelect={setRating} />
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

      {photos.length > 0 && (
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
          {photos.map(({ preview: src }, i) => (
            <div key={src} className="relative flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden motion-safe:animate-item-in">
              <Image src={src} alt={`Photo ${i + 1}`} fill sizes="64px" unoptimized className="object-cover" />
              <button
                type="button"
                onClick={() => removePhoto(src)}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center"
                aria-label={`Remove photo ${i + 1}`}
              >
                <X className="w-3 h-3 text-white" strokeWidth={3} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 mt-3">
        <button
          type="button"
          onClick={() => photoInputRef.current?.click()}
          disabled={isUploading}
          className="relative flex-shrink-0 w-12 rounded-xl bg-white/10 text-white border border-white/20 hover:bg-white/20 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center"
          aria-label="Attach photos"
          title={t('addPhotos')}
        >
          <ImagePlus className="w-5 h-5" />
          {files.length > 0 && (
            <span
              key={files.length}
              className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full bg-sky-500 text-white text-xs font-bold flex items-center justify-center motion-safe:animate-badge-pop"
            >
              {files.length}
            </span>
          )}
        </button>
        <button
          onClick={handleSubmit}
          disabled={isUploading || (rating === 0 && files.length === 0)}
          className="flex-1 py-3 rounded-xl font-medium bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
        >
          <Send className="w-4 h-4" />
          {isUploading ? t('submittingReview') : t('submitReview')}
        </button>
      </div>
      <input id="review-photos-input" ref={photoInputRef} type="file" accept="image/*" multiple onChange={handlePickPhotos} className="hidden" />
    </div>
  );
}
