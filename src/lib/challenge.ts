// The launch challenge (growth plan §8), pure. KEEP IN SYNC with functions/src/lib/challenge.ts.
import type { TranslationKey } from './translations';

export const CHALLENGE_STEPS = ['spot', 'review', 'follow', 'visit', 'favorite'] as const;
export type ChallengeStep = typeof CHALLENGE_STEPS[number];

/** 2027-06-30 23:59:59 Budapest (CEST, UTC+2). */
export const LAUNCH_END_MS = Date.UTC(2027, 5, 30, 21, 59, 59);
export const FOUNDER_BADGE = 'founder';
export const FOUNDER_XP = 50;

export const STEP_TEXT: Record<ChallengeStep, TranslationKey> = {
  spot: 'challengeSpot',
  review: 'challengeReview',
  follow: 'challengeFollow',
  visit: 'challengeVisit',
  favorite: 'challengeFavorite',
};

export function seasonOpen(now: number, configEnd: number | null): boolean {
  return now <= (configEnd ?? LAUNCH_END_MS);
}

export function doneCount(done: Record<ChallengeStep, boolean>): number {
  return CHALLENGE_STEPS.filter((s) => done[s]).length;
}

/** The known badges of a stored list. */
export function badgesOf(x: unknown): string[] {
  return Array.isArray(x) ? x.filter((b): b is string => b === FOUNDER_BADGE) : [];
}
