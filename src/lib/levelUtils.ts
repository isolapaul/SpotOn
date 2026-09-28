/**
 * User Level System Utilities
 * 
 * Level Thresholds:
 * - Level 1: 0-2 spots (no special benefits)
 * - Level 2: 3-9 spots (silver name color)
 * - Level 3: 10-14 spots (gold name + highlight 1 spot that appears gold to others)
 * - Level 4: 15-19 spots (gold name + highlight 2 spots + custom icons)
 * - Level 5: 20+ spots (diamond name + badge + custom name color/font)
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
  icon: string; // Emoji icon
  spotsRequired: number;
  spotsForNext: number | null; // null if max level
  maxHighlights: number;
  canCustomizeIcon: boolean;
  canCustomizeName: boolean; // color and font
}

export const LEVEL_THRESHOLDS: readonly { level: number; spotsRequired: number; nameKey: TranslationKey; icon: string }[] = [
  { level: 1, spotsRequired: 0, nameKey: 'levelBeginner', icon: '🌱' },
  { level: 2, spotsRequired: 3, nameKey: 'levelExplorer', icon: '🥈' },
  { level: 3, spotsRequired: 10, nameKey: 'levelMaster', icon: '🥇' },
  { level: 4, spotsRequired: 15, nameKey: 'levelLegend', icon: '⭐' },
  { level: 5, spotsRequired: 20, nameKey: 'levelDiamond', icon: '💎' },
];

/**
 * Spots required to reach `level` (1-5), from LEVEL_THRESHOLDS; 0 for any other level.
 */
export function getLevelThreshold(level: number): number {
  return LEVEL_THRESHOLDS.find((threshold) => threshold.level === level)?.spotsRequired ?? 0;
}

/**
 * Calculate user level based on number of spots created
 */
export function calculateLevel(spotsCount: number): number {
  if (spotsCount >= 20) return 5;
  if (spotsCount >= 15) return 4;
  if (spotsCount >= 10) return 3;
  if (spotsCount >= 3) return 2;
  return 1;
}

/**
 * Get detailed information about a user's level
 */
export function getLevelInfo(spotsCount: number): LevelInfo {
  const level = calculateLevel(spotsCount);
  const currentThreshold = LEVEL_THRESHOLDS[level - 1];
  const nextThreshold = LEVEL_THRESHOLDS[level];

  let textColor = 'text-white/90'; // Level 1
  let bgColor = 'bg-gray-500/20';
  let borderColor = 'border-gray-500/30';
  let progressColor = '#6b7280'; // gray-500
  let progressBarClass = 'bg-gray-500/80';
  
  if (level === 2) {
    textColor = 'text-gray-300'; // Silver
    bgColor = 'bg-gray-400/20';
    borderColor = 'border-gray-400/30';
    progressColor = '#9ca3af'; // gray-400
    progressBarClass = 'bg-gray-400/80';
  } else if (level === 3) {
    textColor = 'text-yellow-400'; // Gold
    bgColor = 'bg-yellow-500/20';
    borderColor = 'border-yellow-500/30';
    progressColor = '#eab308'; // yellow-500
    progressBarClass = 'bg-yellow-500/80';
  } else if (level === 4) {
    textColor = 'text-yellow-400'; // Gold (same as level 3)
    bgColor = 'bg-yellow-500/20';
    borderColor = 'border-yellow-500/30';
    progressColor = '#eab308'; // yellow-500
    progressBarClass = 'bg-yellow-500/80';
  } else if (level === 5) {
    textColor = 'text-cyan-300'; // Diamond
    bgColor = 'bg-cyan-500/20';
    borderColor = 'border-cyan-500/30';
    progressColor = '#06b6d4'; // cyan-500
    progressBarClass = 'bg-cyan-500/80';
  }

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
    icon: currentThreshold.icon,
    spotsRequired: currentThreshold.spotsRequired,
    spotsForNext: nextThreshold ? nextThreshold.spotsRequired : null,
    maxHighlights,
    canCustomizeIcon: level >= 4,
    canCustomizeName: level >= 5,
  };
}

/**
 * Get progress percentage to next level
 */
export function getLevelProgress(spotsCount: number): number {
  const levelInfo = getLevelInfo(spotsCount);
  
  if (levelInfo.spotsForNext === null) {
    return 100; // Max level reached
  }

  const currentLevelSpots = levelInfo.spotsRequired;
  const nextLevelSpots = levelInfo.spotsForNext;
  const progress = ((spotsCount - currentLevelSpots) / (nextLevelSpots - currentLevelSpots)) * 100;
  
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

export function getUserNameColor(spotsCount: number, customColor?: string): string {
  const resolvedCustom = getCustomNameColorValue(customColor);
  if (resolvedCustom) return resolvedCustom;

  const level = calculateLevel(spotsCount);
  return LEVEL_NAME_COLORS[level] || LEVEL_NAME_COLORS[1];
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

/**
 * Translated "spots to the next level" / "max level reached" text
 */
export function getSpotsRemainingText(
  spotsCount: number,
  spotsForNext: number | null,
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string,
): string {
  if (spotsForNext === null) {
    return t('maxLevelReached');
  }
  const remaining = spotsForNext - spotsCount;
  return t('spotsToNextLevel', { count: remaining });
}
