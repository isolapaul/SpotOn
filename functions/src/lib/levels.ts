/**
 * Server copy of the level system and the level-5 name-style allowlists.
 *
 * KEEP IN SYNC with src/lib/levelUtils.ts (parity test: functions/test/levels.parity.test.ts)
 *
 * Pure: no imports. Spot counts include every status (D8: pending spots count).
 */

/** Minimum spot count per level (same table as LEVEL_THRESHOLDS in levelUtils.ts). */
export const LEVEL_THRESHOLDS: readonly {level: number; spotsRequired: number}[] = [
  {level: 1, spotsRequired: 0},
  {level: 2, spotsRequired: 3},
  {level: 3, spotsRequired: 10},
  {level: 4, spotsRequired: 15},
  {level: 5, spotsRequired: 20},
];

/** Level for a spot count: 20+ → 5, 15+ → 4, 10+ → 3, 3+ → 2, else 1. */
export function calculateLevel(spotsCount: number): number {
  if (spotsCount >= 20) return 5;
  if (spotsCount >= 15) return 4;
  if (spotsCount >= 10) return 3;
  if (spotsCount >= 3) return 2;
  return 1;
}

/** Highlight slots for a spot count: level 4+ → 2, level 3 → 1, else 0. */
export function maxHighlightsForCount(spotsCount: number): number {
  const level = calculateLevel(spotsCount);
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
