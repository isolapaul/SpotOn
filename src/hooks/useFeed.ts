import { useMemo } from 'react';
import { useSpotStore } from '@/store/useSpotStore';
import { useFollowStore } from '@/store/useFollowStore';
import { useSafetyStore } from '@/store/useSafetyStore';
import { useUserStore } from '@/store/useUserStore';
import { useFeedStore } from '@/store/useFeedStore';
import { buildFeed, countUnseen, type FeedSections } from '@/lib/feed';

/**
 * The following feed: approved spots of the people the user follows, then everyone else's (people
 * the user blocked left out). `ready` once whom the user follows is known (signed out: at once).
 */
export function useFeed(
  near: { lat: number; lng: number } | null = null,
): FeedSections & { ready: boolean; followsAnyone: boolean } {
  const spots = useSpotStore((s) => s.spots);
  const me = useUserStore((s) => s.user?.uid ?? null);
  const following = useFollowStore((s) => s.following);
  const followingReady = useFollowStore((s) => s.followingReady);
  const blocked = useSafetyStore((s) => s.blocked);
  const sections = useMemo(
    () => buildFeed(spots, { following, me, hidden: blocked, near }),
    [spots, following, me, blocked, near],
  );
  return { ...sections, ready: !me || followingReady, followsAnyone: following.size > 0 };
}

/** New followed spots since the feed was last opened (the launcher's dot; never opened: all of them). */
export function useFeedUnseen(): number {
  const { followed } = useFeed();
  const seenAt = useFeedStore((s) => s.seenAt);
  const me = useUserStore((s) => s.user?.uid ?? null);
  return useMemo(() => countUnseen(followed, seenAt, me), [followed, seenAt, me]);
}
