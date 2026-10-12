/**
 * The launch challenge (growth plan §8), pure: five easy first steps during the launch season;
 * completing them earns the "Founder" badge and FOUNDER_XP. The season ends at
 * config/app.launchChallengeEnd, else LAUNCH_END_MS. KEEP IN SYNC with src/lib/challenge.ts.
 */
export const CHALLENGE_STEPS = ["spot", "review", "follow", "visit", "favorite"] as const;
export type ChallengeStep = typeof CHALLENGE_STEPS[number];

/** 2027-06-30 23:59:59 Budapest (CEST, UTC+2). */
export const LAUNCH_END_MS = Date.UTC(2027, 5, 30, 21, 59, 59);
export const FOUNDER_BADGE = "founder";
export const FOUNDER_XP = 50;

export function seasonOpen(now: number, configEnd: unknown): boolean {
  const end = typeof configEnd === "number" ? configEnd :
    typeof (configEnd as {toMillis?: unknown})?.toMillis === "function" ?
      (configEnd as {toMillis: () => number}).toMillis() : LAUNCH_END_MS;
  return now <= end;
}

/** The steps not done yet. */
export function missingSteps(done: Record<ChallengeStep, boolean>): ChallengeStep[] {
  return CHALLENGE_STEPS.filter((s) => !done[s]);
}

/** The stored badges (an array of known strings). */
export function badgesOf(x: unknown): string[] {
  return Array.isArray(x) ? x.filter((b): b is string => b === FOUNDER_BADGE) : [];
}

/** XP from badges. */
export function badgeXp(badges: unknown): number {
  return badgesOf(badges).includes(FOUNDER_BADGE) ? FOUNDER_XP : 0;
}
