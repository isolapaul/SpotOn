// The launch challenge's claim (growth plan §8): the server checks the five steps again.
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import type { ChallengeStep } from '@/lib/challenge';
import { track } from './telemetry';

const claimCallable = httpsCallable<unknown, { badge: string | null; missing: ChallengeStep[] }>(functions, 'claimChallengeBadge');

export async function claimChallengeBadge(): Promise<{ badge: string | null; missing: ChallengeStep[] }> {
  const { data } = await claimCallable({});
  if (data.badge) track('challenge_done');
  return data;
}
