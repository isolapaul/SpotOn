'use client';

import { Star } from 'lucide-react';
import type { Review } from '@/store/useSpotStore';
import { useT } from '@/hooks/useT';
import { usePublicProfiles } from '@/hooks/usePublicProfile';
import { useReplies } from '@/hooks/useReplies';
import { useIsBlocked } from '@/store/useSafetyStore';
import ReviewCard from './ReviewCard';

interface ReviewListProps {
  reviews: Review[] | undefined;
  spotId: string;
  /** An approved spot: replies and reports are possible. */
  reportable: boolean;
}

/** The spot's reviews with their replies (people the user blocked are hidden), or the empty state. */
export default function ReviewList({ reviews: all, spotId, reportable }: Readonly<ReviewListProps>) {
  const t = useT();
  const isBlocked = useIsBlocked();
  const reviews = all?.filter((r) => !isBlocked(r.userId));
  const replies = useReplies(spotId, reportable).filter((r) => !isBlocked(r.userId));
  const profiles = usePublicProfiles(reviews?.map((r) => r.userId) ?? []);

  if (!reviews?.length) {
    return (
      <div className="rounded-[18px] bg-surface-1 p-6 text-center">
        <Star className="w-12 h-12 text-white/40 mx-auto mb-3" />
        <p className="text-white/60">{t('noReviews')}</p>
        <p className="text-white/40 text-sm mt-1">{t('beFirstToReview')}</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {reviews.map((review) => (
        <ReviewCard
          key={review.id}
          review={review}
          profile={profiles[review.userId]}
          spotId={spotId}
          open={reportable}
          replies={replies.filter((r) => r.reviewId === review.id)}
        />
      ))}
    </div>
  );
}
