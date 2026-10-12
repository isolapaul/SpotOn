import { useCallback, useMemo, useState } from 'react';
import { CHALLENGE_STEPS, FOUNDER_BADGE, seasonOpen, type ChallengeStep } from '@/lib/challenge';
import { useUserStore } from '@/store/useUserStore';
import { useSpotStore } from '@/store/useSpotStore';
import { useFollowStore } from '@/store/useFollowStore';
import { useVisitStore } from '@/store/useVisitStore';
import { useMyLevelStore } from '@/store/useMyLevelStore';
import { useAppConfigStore } from '@/store/useAppConfigStore';
import { claimChallengeBadge } from '@/store/challenge';

/**
 * The launch challenge (growth plan §8): the five steps as the device sees them (the server checks
 * them again when the badge is claimed), whether it runs, and the claim.
 */
export function useLaunchChallenge() {
  const user = useUserStore((s) => s.user);
  const spots = useSpotStore((s) => s.spots);
  const following = useFollowStore((s) => s.following);
  const visits = useVisitStore((s) => s.visits.length);
  const badges = useMyLevelStore((s) => s.badges);
  const configEnd = useAppConfigStore((s) => s.config.launchChallengeEnd);
  const [now] = useState(() => Date.now());
  const uid = user?.uid ?? null;

  const done = useMemo<Record<ChallengeStep, boolean>>(() => ({
    spot: !!uid && spots.some((s) => s.createdBy === uid),
    review: !!uid && spots.some((s) => s.createdBy !== uid && (s.reviews ?? []).some((r) => r.userId === uid)),
    follow: following.size > 0,
    visit: visits > 0,
    favorite: (user?.savedSpots.length ?? 0) > 0,
  }), [uid, spots, following, visits, user?.savedSpots.length]);

  const claimed = badges.includes(FOUNDER_BADGE);
  const allDone = CHALLENGE_STEPS.every((s) => done[s]);
  const claim = useCallback(() => claimChallengeBadge(), []);
  return { active: !!uid && seasonOpen(now, configEnd), done, allDone, claimed, claim };
}
