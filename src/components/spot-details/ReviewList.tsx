'use client';

import Image from 'next/image';
import { Star } from 'lucide-react';
import type { Review } from '@/store/useSpotStore';
import { useLanguage, useT } from '@/hooks/useT';
import { usePublicProfiles } from '@/hooks/usePublicProfile';
import { dateLocale } from '@/lib/dates';
import StarRating from '../ui/StarRating';
import ReviewerBadge from './ReviewerBadge';

interface ReviewListProps {
  reviews: Review[] | undefined;
}

/** The spot's reviews (reviewer name/level/admin badge from public profiles), or the empty state. */
export default function ReviewList({ reviews }: Readonly<ReviewListProps>) {
  const t = useT();
  // Date locale: English while no language is chosen yet (unchanged pre-T24 behaviour).
  const language = useLanguage({ fallback: 'en' });
  const reviewerProfiles = usePublicProfiles(reviews?.map((r) => r.userId) ?? []);

  return (
    <div className="space-y-3">
      {!reviews?.length ? (
        <div className="glass-card p-6 text-center">
          <Star className="w-12 h-12 text-white/40 mx-auto mb-3" />
          <p className="text-white/60">{t('noReviews')}</p>
          <p className="text-white/40 text-sm mt-1">{t('beFirstToReview')}</p>
        </div>
      ) : (
        reviews.map((review) => (
          <div key={review.id} className="glass-card p-4">
            <div className="flex items-start gap-3">
              {review.userPhoto && (
                <div className="relative w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
                  <Image src={review.userPhoto} alt={review.userName} fill sizes="40px" className="object-cover" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <ReviewerBadge profile={reviewerProfiles[review.userId]} review={review} />
                  <span className="text-white/40 text-xs">
                    {review.createdAt?.toDate
                      ? new Date(review.createdAt.toDate()).toLocaleDateString(dateLocale(language), { month: 'short', day: 'numeric' })
                      : ''}
                  </span>
                </div>
                <StarRating rating={review.rating} size="sm" emptyTone="dim" />
                {review.comment && <p className="text-white/80 text-sm mt-2">{review.comment}</p>}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
