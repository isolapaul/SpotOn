/**
 * Server copy of the level system and the level-5 name-style allowlists.
 *
 * KEEP IN SYNC with src/lib/levelUtils.ts (parity test: functions/test/levels.parity.test.ts)
 *
 * Pure: no imports. Levels come from XP (item 5): an approved spot, a review of someone else's
 * approved spot and an approved photo earn XP_REWARDS. Nobody drops below the level they had
 * under the old spot-count rule (levelFloor, frozen once per user).
 */

/** XP per contribution. */
export const XP_REWARDS = {approvedSpot: 10, review: 2, approvedPhoto: 3} as const;

/** Minimum XP per level (same table as LEVEL_THRESHOLDS in levelUtils.ts). */
export const LEVEL_THRESHOLDS: readonly {level: number; xpRequired: number}[] = [
  {level: 1, xpRequired: 0},
  {level: 2, xpRequired: 30},
  {level: 3, xpRequired: 100},
  {level: 4, xpRequired: 150},
  {level: 5, xpRequired: 200},
];

export const MAX_LEVEL = 5;

/** Level for an XP total. */
export function levelForXp(xp: number): number {
  let level = 1;
  for (const t of LEVEL_THRESHOLDS) if (xp >= t.xpRequired) level = t.level;
  return level;
}

/** The old rule, spots of every status: 20+ → 5, 15+ → 4, 10+ → 3, 3+ → 2, else 1 (the floor). */
export function levelForSpotCount(spotsCount: number): number {
  if (spotsCount >= 20) return 5;
  if (spotsCount >= 15) return 4;
  if (spotsCount >= 10) return 3;
  if (spotsCount >= 3) return 2;
  return 1;
}

/** A stored level (1-5), else null. */
export function validLevel(x: unknown): number | null {
  return typeof x === "number" && Number.isInteger(x) && x >= 1 && x <= MAX_LEVEL ? x : null;
}

/** The level shown and enforced: the XP level, never below the floor. */
export function effectiveLevel(xp: number, levelFloor: number): number {
  return Math.max(levelForXp(xp), levelFloor);
}

/** Highlight slots for a level: 4+ → 2, 3 → 1, else 0. */
export function maxHighlightsForLevel(level: number): number {
  if (level >= 4) return 2;
  if (level >= 3) return 1;
  return 0;
}

/** Custom name colour/font requires this level (canCustomizeName). */
export const NAME_STYLE_MIN_LEVEL = 5;

/** Allowlisted CUSTOM_NAME_COLORS values. */
export const NAME_COLORS: readonly string[] = [
  "text-cyan-300",
  "text-purple-400",
  "text-emerald-400",
  "text-rose-400",
  "text-yellow-300",
  "text-slate-300",
  "text-orange-400",
];

/** Allowlisted CUSTOM_NAME_FONTS values. */
export const NAME_FONTS: readonly string[] = [
  "font-sans",
  "font-bold",
  "font-serif",
  "font-mono",
  "font-serif italic",
  "font-extrabold",
  "font-light italic",
];
