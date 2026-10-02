/**
 * User level system (item 5): levels come from XP.
 * - XP: approved spot +10, review of someone else's approved spot +2 (once per spot), approved
 *   photo +3. The server stores it (users/publicProfiles .xp/.level); deleting takes it back.
 * - Levels: 1 from 0 XP, 2 from 30, 3 from 100 (1 highlight), 4 from 150 (2 highlights, custom
 *   icons), 5 from 200 (custom name colour/font).
 * - Nobody drops below the level they had under the old spot-count rule (the server's levelFloor);
 *   profiles the server has not computed yet show that old level (levelForSpotCount).
 *
 * Relative imports only, and only `import type` from translations: the functions vitest
 * (functions/test/levels.parity.test.ts) imports this file and has no `@/` alias.
 */

import type { TranslationKey } from './translations';
import { NAME_COLORS, NAME_FONTS, resolveNameColorHex, type NameColorValue, type NameFontValue } from './nameStyle';

export interface LevelInfo {
  level: number;
  nameKey: TranslationKey; // Level name, translate with t()
  color: string; // Tailwind color class
  textColor: string; // For displaying username
  bgColor: string; // For badges
  borderColor: string; // For borders
  progressColor: string; // Hex color for progress bar fill
  progressBarClass: string; // Tailwind class for the level-info progress bar fill
  xpRequired: number;
  xpForNext: number | null; // null if max level
  maxHighlights: number;
  canCustomizeIcon: boolean;
  canCustomizeName: boolean; // color and font
}

/** XP per contribution (the server's XP_REWARDS). */
export const XP_REWARDS = { approvedSpot: 10, review: 2, approvedPhoto: 3 } as const;

// Badges and colours per level: lib/levelTheme (no emoji).
export const LEVEL_THRESHOLDS: readonly { level: number; xpRequired: number; nameKey: TranslationKey }[] = [
  { level: 1, xpRequired: 0, nameKey: 'levelBeginner' },
  { level: 2, xpRequired: 30, nameKey: 'levelExplorer' },
  { level: 3, xpRequired: 100, nameKey: 'levelMaster' },
  { level: 4, xpRequired: 150, nameKey: 'levelLegend' },
  { level: 5, xpRequired: 200, nameKey: 'levelDiamond' },
];

export const MAX_LEVEL = 5;

/** UI tints per level, matching the badge colours in lib/levelTheme (static Tailwind strings). */
const LEVEL_TINTS: Record<number, { textColor: string; bgColor: string; borderColor: string; progressColor: string; progressBarClass: string }> = {
  1: { textColor: 'text-emerald-300', bgColor: 'bg-emerald-500/15', borderColor: 'border-emerald-400/30', progressColor: '#34C759', progressBarClass: 'bg-linear-to-r from-[#5EE08A] to-[#0E8A4F]' },
  2: { textColor: 'text-sky-300', bgColor: 'bg-sky-500/15', borderColor: 'border-sky-400/30', progressColor: '#0A84FF', progressBarClass: 'bg-linear-to-r from-[#6FD3FF] to-[#0A64D6]' },
  3: { textColor: 'text-violet-300', bgColor: 'bg-violet-500/15', borderColor: 'border-violet-400/30', progressColor: '#AF52DE', progressBarClass: 'bg-linear-to-r from-[#D59BFF] to-[#6E2FD6]' },
  4: { textColor: 'text-orange-300', bgColor: 'bg-orange-500/15', borderColor: 'border-orange-400/30', progressColor: '#FF9F0A', progressBarClass: 'bg-linear-to-r from-[#FFD66B] to-[#FF7A00]' },
  5: { textColor: 'text-fuchsia-300', bgColor: 'bg-fuchsia-500/15', borderColor: 'border-fuchsia-400/30', progressColor: '#C084FC', progressBarClass: 'bg-linear-to-r from-[#5EEAD4] via-[#A78BFA] to-[#F472B6]' },
};

function clampLevel(level: number): number {
  return Number.isInteger(level) ? Math.min(Math.max(level, 1), MAX_LEVEL) : 1;
}

/** XP required to reach `level` (1-5), from LEVEL_THRESHOLDS; 0 for any other level. */
export function getLevelThreshold(level: number): number {
  return LEVEL_THRESHOLDS.find((threshold) => threshold.level === level)?.xpRequired ?? 0;
}

/** Level for an XP total. */
export function levelForXp(xp: number): number {
  let level = 1;
  for (const t of LEVEL_THRESHOLDS) if (xp >= t.xpRequired) level = t.level;
  return level;
}

/** The old rule, spots of every status: 20+ → 5, 15+ → 4, 10+ → 3, 3+ → 2, else 1. */
export function levelForSpotCount(spotsCount: number): number {
  if (spotsCount >= 20) return 5;
  if (spotsCount >= 15) return 4;
  if (spotsCount >= 10) return 3;
  if (spotsCount >= 3) return 2;
  return 1;
}

/**
 * A public profile's level: the server's `level`, or (not computed yet) the old spot-count
 * level from `spotsCount`.
 */
export function profileLevel(profile: { level?: number; spotsCount?: number } | null | undefined): number {
  const level = profile?.level;
  if (typeof level === 'number' && Number.isInteger(level) && level >= 1 && level <= MAX_LEVEL) return level;
  return levelForSpotCount(profile?.spotsCount ?? 0);
}

/** Static information about a level (1-5; anything else is clamped). */
export function getLevelInfo(levelInput: number): LevelInfo {
  const level = clampLevel(levelInput);
  const currentThreshold = LEVEL_THRESHOLDS[level - 1];
  const nextThreshold = LEVEL_THRESHOLDS[level];

  const { textColor, bgColor, borderColor, progressColor, progressBarClass } = LEVEL_TINTS[level];

  const maxHighlights = (() => {
    if (level >= 4) return 2;
    if (level >= 3) return 1;
    return 0;
  })();

  return {
    level,
    nameKey: currentThreshold.nameKey,
    color: textColor,
    textColor,
    bgColor,
    borderColor,
    progressColor,
    progressBarClass,
    xpRequired: currentThreshold.xpRequired,
    xpForNext: nextThreshold ? nextThreshold.xpRequired : null,
    maxHighlights,
    canCustomizeIcon: level >= 4,
    canCustomizeName: level >= 5,
  };
}

/**
 * Progress to the next level in percent (100 at the top). A level held by the floor with less XP
 * than it needs shows 0.
 */
export function getLevelProgress(xp: number, info: LevelInfo): number {
  if (info.xpForNext === null) return 100;
  const progress = ((xp - info.xpRequired) / (info.xpForNext - info.xpRequired)) * 100;
  return Math.min(Math.max(progress, 0), 100);
}

/**
 * Get the user's name color based on their level
 * If user has custom color (level 5), return that instead
 */
const LEVEL_NAME_COLORS: Record<number, string> = {
  1: '#cd7f32', // bronze
  2: '#aeb4bf', // silver
  3: '#f5c542', // gold
  4: '#f5c542', // gold
  5: '#06b6d4', // fallback
};

/**
 * Hex colour for an allowlisted custom name colour, else undefined. Raw '#…', 'rgb…' and
 * 'hsl…' values are not honoured (SEC-05); callers fall back to the level colour.
 */
export function getCustomNameColorValue(customColor?: string): string | undefined {
  return resolveNameColorHex(customColor);
}

export function getUserNameColor(level: number, customColor?: string): string {
  const resolvedCustom = getCustomNameColorValue(customColor);
  if (resolvedCustom) return resolvedCustom;
  return LEVEL_NAME_COLORS[clampLevel(level)];
}

/**
 * Get available custom colors for level 5 users
 */
export const CUSTOM_NAME_COLORS: readonly {
  value: NameColorValue;
  labelKey: TranslationKey;
  textClass: string;
  selectedClass: string;
}[] = (Object.keys(NAME_COLORS) as NameColorValue[]).map((value) => ({
  value,
  labelKey: NAME_COLORS[value].labelKey,
  textClass: NAME_COLORS[value].textClass,
  selectedClass: NAME_COLORS[value].selectedClass,
}));

/**
 * Get available custom fonts for level 5 users
 */
export const CUSTOM_NAME_FONTS: readonly {
  value: NameFontValue;
  labelKey: TranslationKey;
  className: string;
}[] = (Object.keys(NAME_FONTS) as NameFontValue[]).map((value) => ({
  value,
  labelKey: NAME_FONTS[value].labelKey,
  className: NAME_FONTS[value].className,
}));

/** Translated "N XP to the next level" / "max level reached" text. */
export function getXpRemainingText(
  xp: number,
  info: LevelInfo,
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string,
): string {
  if (info.xpForNext === null) return t('maxLevelReached');
  return t('xpToNextLevel', { count: Math.max(info.xpForNext - xp, 0) });
}
