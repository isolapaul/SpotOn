'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Send } from 'lucide-react';
import { useSpotStore, type Spot } from '@/store/useSpotStore';
import { useToastStore } from '@/store/useToastStore';
import { useT } from '@/hooks/useT';
import type { User } from '@/lib/mapUserDoc';
import StarRating from '../ui/StarRating';

interface ReviewFormProps {
  spot: Spot;
  user: User;
}

/** The signed-in user's review form: star rating, comment and submit (one review per user). */
export default function ReviewForm({ spot, user }: Readonly<ReviewFormProps>) {
  const addReview = useSpotStore((s) => s.addReview);
  const showToast = useToastStore((s) => s.showToast);
  const t = useT();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmitReview = async () => {
    if (rating === 0) { showToast(t('ratingRequired'), 'error'); return; }
    if (isSubmitting) return;
    if (spot.reviews?.some((r) => r.userId === user.uid)) {
      showToast(t('alreadyReviewed'), 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      // BUG-25: no local append; the spots listener delivers the new review and the panel shows it live (T29).
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
    } catch {
      showToast(t('reviewError'), 'error');
    } finally {
      setIsSubmitting(false);
    }
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
      <button
        onClick={handleSubmitReview}
        disabled={isSubmitting || rating === 0}
        className="mt-3 w-full py-3 rounded-xl font-medium bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
      >
        <Send className="w-4 h-4" />
        {isSubmitting ? t('submittingReview') : t('submitReview')}
      </button>
    </div>
  );
}
