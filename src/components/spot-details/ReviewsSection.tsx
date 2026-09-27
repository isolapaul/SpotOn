'use client';

import type { Spot } from '@/store/useSpotStore';
import { useUserStore } from '@/store/useUserStore';
import { useT } from '@/hooks/useT';
import ReviewForm from './ReviewForm';
import AddPhotosCard from './AddPhotosCard';
import ReviewList from './ReviewList';

interface ReviewsSectionProps {
  spot: Spot;
}

/** Reviews heading, the review form (signed in), the add-photos card and the review list. */
export default function ReviewsSection({ spot }: Readonly<ReviewsSectionProps>) {
  const user = useUserStore((s) => s.user);
  const t = useT();
  return (
    <div>
      <h2 className="text-xl font-bold text-white mb-4">{t('reviews')}</h2>

      {user && <ReviewForm spot={spot} user={user} />}

      <AddPhotosCard spotId={spot.id} />

      <ReviewList reviews={spot.reviews} />
    </div>
  );
}
