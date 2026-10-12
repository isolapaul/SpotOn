import { useEffect } from 'react';
import { useInboxStore } from '@/store/useInboxStore';
import { maybeAskForReview } from '@/store/reviewPrompt';

/** After the user's spot is approved (the notice arrives while the app is open), ask for a rating. */
export function useReviewPrompt() {
  const fresh = useInboxStore((s) => s.fresh);
  useEffect(() => {
    if (fresh?.type !== 'spot_approved') return;
    // After the notice has had its moment.
    const timer = setTimeout(() => void maybeAskForReview(), 2500);
    return () => clearTimeout(timer);
  }, [fresh]);
}
