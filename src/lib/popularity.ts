// How famous a spot is (growth plan §3), pure: views count once each, likes, reviews and visits
// weigh more (a review or a visit says more than a glance). The counters come from the server
// (viewCount / visitCount rolled up daily, likeCount live).
import type { Spot } from '@/store/useSpotStore';

export const POPULARITY_WEIGHTS = { view: 1, like: 5, review: 10, visit: 10 } as const;

const n = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x > 0 ? x : 0);

export function popularity(spot: Pick<Spot, 'viewCount' | 'likeCount' | 'visitCount' | 'reviews'>): number {
  return n(spot.viewCount) * POPULARITY_WEIGHTS.view
    + n(spot.likeCount) * POPULARITY_WEIGHTS.like
    + (spot.reviews?.length ?? 0) * POPULARITY_WEIGHTS.review
    + n(spot.visitCount) * POPULARITY_WEIGHTS.visit;
}

/** The ids of the `count` most popular spots (ties: the older id order stays). */
export function mostPopularIds(spots: ReadonlyArray<Pick<Spot, 'id' | 'viewCount' | 'likeCount' | 'visitCount' | 'reviews'>>, count: number): Set<string> {
  return new Set([...spots].sort((a, b) => popularity(b) - popularity(a)).slice(0, count).map((s) => s.id));
}

/** A compact count: 999, 1.2k, 12k. */
export function compactCount(value: number): string {
  if (value < 1000) return String(Math.max(0, Math.floor(value)));
  const k = value / 1000;
  return `${k < 10 ? Math.floor(k * 10) / 10 : Math.floor(k)}k`;
}
