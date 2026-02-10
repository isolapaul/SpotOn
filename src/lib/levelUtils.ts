/**
 * User Level System Utilities
 * 
 * Level Thresholds:
 * - Level 1: 0-2 spots (no special benefits)
 * - Level 2: 3-9 spots (silver name color)
 * - Level 3: 10-14 spots (gold name + highlight 1 spot that appears gold to others)
 * - Level 4: 15-19 spots (gold name + highlight 2 spots + custom icons)
 * - Level 5: 20+ spots (diamond name + badge + custom name color/font)
 */

export interface LevelInfo {
  level: number;
  name: string;
  color: string; // Tailwind color class
  textColor: string; // For displaying username
  bgColor: string; // For badges
  borderColor: string; // For borders
  progressColor: string; // Hex color for progress bar fill
  icon: string; // Emoji icon
  spotsRequired: number;
  spotsForNext: number | null; // null if max level
  maxHighlights: number;
  canCustomizeIcon: boolean;
  canCustomizeName: boolean; // color and font
}

export const LEVEL_THRESHOLDS = [
  { level: 1, spotsRequired: 0, name: 'Kezdő', icon: '🌱' },
  { level: 2, spotsRequired: 3, name: 'Haladó', icon: '🥈' },
  { level: 3, spotsRequired: 10, name: 'Felfedező', icon: '🥇' },
  { level: 4, spotsRequired: 15, name: 'Spotmester', icon: '⭐' },
  { level: 5, spotsRequired: 20, name: 'Vilagutazo', icon: '💎' },
];

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
  
  if (level === 2) {
    textColor = 'text-gray-300'; // Silver
    bgColor = 'bg-gray-400/20';
    borderColor = 'border-gray-400/30';
    progressColor = '#9ca3af'; // gray-400
  } else if (level === 3) {
    textColor = 'text-yellow-400'; // Gold
    bgColor = 'bg-yellow-500/20';
    borderColor = 'border-yellow-500/30';
    progressColor = '#eab308'; // yellow-500
  } else if (level === 4) {
    textColor = 'text-yellow-400'; // Gold (same as level 3)
    bgColor = 'bg-yellow-500/20';
    borderColor = 'border-yellow-500/30';
    progressColor = '#eab308'; // yellow-500
  } else if (level === 5) {
    textColor = 'text-cyan-300'; // Diamond
    bgColor = 'bg-cyan-500/20';
    borderColor = 'border-cyan-500/30';
    progressColor = '#06b6d4'; // cyan-500
  }

  const maxHighlights = (() => {
    if (level >= 4) return 2;
    if (level >= 3) return 1;
    return 0;
  })();

  return {
    level,
    name: currentThreshold.name,
    color: textColor,
    textColor,
    bgColor,
    borderColor,
    progressColor,
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
  2: '#c0c0c0', // silver
  3: '#f5c542', // gold
  4: '#f5c542', // gold
  5: '#06b6d4', // fallback
};

const CUSTOM_NAME_COLOR_VALUES: Record<string, string> = {
  'text-cyan-300': '#67e8f9',
  'text-purple-400': '#c084fc',
  'text-emerald-400': '#34d399',
  'text-rose-400': '#fb7185',
  'text-yellow-300': '#fde047',
  'text-slate-300': '#cbd5e1',
  'text-orange-400': '#fb923c',
};

export function getCustomNameColorValue(customColor?: string): string | undefined {
  if (!customColor) return undefined;
  if (customColor.startsWith('#') || customColor.startsWith('rgb') || customColor.startsWith('hsl')) {
    return customColor;
  }
  return CUSTOM_NAME_COLOR_VALUES[customColor];
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
export const CUSTOM_NAME_COLORS = [
  { name: 'Gyémánt Kék', value: 'text-cyan-300', gradient: 'from-cyan-400 to-blue-500' },
  { name: 'Lila Varázs', value: 'text-purple-400', gradient: 'from-purple-400 to-pink-500' },
  { name: 'Smaragdzöld', value: 'text-emerald-400', gradient: 'from-emerald-400 to-green-500' },
  { name: 'Rubin Vörös', value: 'text-rose-400', gradient: 'from-rose-400 to-red-500' },
  { name: 'Aranyfény', value: 'text-yellow-300', gradient: 'from-yellow-300 to-amber-500' },
  { name: 'Ezüst Holdfény', value: 'text-slate-300', gradient: 'from-slate-300 to-gray-400' },
  { name: 'Tüzes Narancs', value: 'text-orange-400', gradient: 'from-orange-400 to-red-500' },
];

/**
 * Get available custom fonts for level 5 users
 */
export const CUSTOM_NAME_FONTS = [
  { name: 'Normál', value: 'font-sans' },
  { name: 'Félkövér', value: 'font-bold' },
  { name: 'Kézírás', value: 'font-serif' },
  { name: 'Modern', value: 'font-mono' },
  { name: 'Elegáns', value: 'font-serif italic' },
  { name: 'Extra Félkövér', value: 'font-extrabold' },
  { name: 'Vékony Elegáns', value: 'font-light italic' },
];

/**
 * Get available custom icons for level 4+ users
 */
export const CUSTOM_SPOT_ICONS = [
  '⭐', '💫', '✨', '🌟', '⚡', '🔥', '💎', '👑', 
  '🎯', '🎪', '🎨', '🎭', '🎬', '🎮', '🎸', '🎺',
  '🌈', '🌸', '🌺', '🌻', '🌼', '🌿', '🍀', '🦋',
  '🦄', '🐉', '🦅', '🦁', '🐺', '🦊', '🦉', '🐼',
];

/**
 * Format spots remaining text for translations
 */
export function getSpotsRemainingText(spotsCount: number, spotsForNext: number | null): string {
  if (spotsForNext === null) {
    return 'Maximum szint elérve! 🎉';
  }
  const remaining = spotsForNext - spotsCount;
  return `${remaining} hely a következő szintig`;
}
