'use client';

import type { Spot } from '@/store/useSpotStore';
import { useUserStore } from '@/store/useUserStore';
import { useT } from '@/hooks/useT';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import ReviewForm from './ReviewForm';
import AddPhotosCard from './AddPhotosCard';
import ReviewList from './ReviewList';

interface ReviewsSectionProps {
  spot: Spot;
}

/** Reviews heading, the review form (signed in, approved spot or admin), the add-photos card and the review list. */
export default function ReviewsSection({ spot }: Readonly<ReviewsSectionProps>) {
  const user = useUserStore((s) => s.user);
  const isAdmin = useIsAdmin();
  const t = useT();
  // The rules accept reviews on approved spots only (admins excepted), so the form is hidden elsewhere (BUG-29).
  const canReview = spot.status === 'approved' || isAdmin;
  return (
    <div>
      <h2 className="text-[20px] font-bold text-label mb-3">{t('reviews')}</h2>

      {user && canReview && <ReviewForm spot={spot} user={user} />}

      <AddPhotosCard spot={spot} />

      <ReviewList reviews={spot.reviews} />
    </div>
  );
}
