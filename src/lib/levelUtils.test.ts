import { describe, expect, it } from 'vitest';
import { getLevelInfo, getSpotsRemainingText, LEVEL_THRESHOLDS } from './levelUtils';
import type { TranslationKey } from './translations';

// Values of getLevelInfo before T22 (only `name` became `nameKey`; progressBarClass is new).
const LEVELS = {
  1: { textColor: 'text-white/90', bgColor: 'bg-gray-500/20', borderColor: 'border-gray-500/30', progressColor: '#6b7280', progressBarClass: 'bg-gray-500/80', nameKey: 'levelBeginner', icon: '🌱', spotsRequired: 0, spotsForNext: 3, maxHighlights: 0, canCustomizeIcon: false, canCustomizeName: false },
  2: { textColor: 'text-gray-300', bgColor: 'bg-gray-400/20', borderColor: 'border-gray-400/30', progressColor: '#9ca3af', progressBarClass: 'bg-gray-400/80', nameKey: 'levelExplorer', icon: '🥈', spotsRequired: 3, spotsForNext: 10, maxHighlights: 0, canCustomizeIcon: false, canCustomizeName: false },
  3: { textColor: 'text-yellow-400', bgColor: 'bg-yellow-500/20', borderColor: 'border-yellow-500/30', progressColor: '#eab308', progressBarClass: 'bg-yellow-500/80', nameKey: 'levelMaster', icon: '🥇', spotsRequired: 10, spotsForNext: 15, maxHighlights: 1, canCustomizeIcon: false, canCustomizeName: false },
  4: { textColor: 'text-yellow-400', bgColor: 'bg-yellow-500/20', borderColor: 'border-yellow-500/30', progressColor: '#eab308', progressBarClass: 'bg-yellow-500/80', nameKey: 'levelLegend', icon: '⭐', spotsRequired: 15, spotsForNext: 20, maxHighlights: 2, canCustomizeIcon: true, canCustomizeName: false },
  5: { textColor: 'text-cyan-300', bgColor: 'bg-cyan-500/20', borderColor: 'border-cyan-500/30', progressColor: '#06b6d4', progressBarClass: 'bg-cyan-500/80', nameKey: 'levelDiamond', icon: '💎', spotsRequired: 20, spotsForNext: null, maxHighlights: 2, canCustomizeIcon: true, canCustomizeName: true },
} as const;

const CASES: Array<[number, keyof typeof LEVELS]> = [
  [0, 1], [2, 1], [3, 2], [9, 2], [10, 3], [14, 3], [15, 4], [19, 4], [20, 5], [100, 5],
];

describe('getLevelInfo', () => {
  it.each(CASES)('%i spots → level %i with unchanged styles', (count, level) => {
    const expected = LEVELS[level];
    expect(getLevelInfo(count)).toEqual({ level, color: expected.textColor, ...expected });
  });

  it('has a static progressBarClass for every level', () => {
    for (const count of [0, 3, 10, 15, 20]) {
      expect(getLevelInfo(count).progressBarClass).toMatch(/^bg-[a-z]+-\d{3}\/80$/);
    }
  });
});

describe('LEVEL_THRESHOLDS', () => {
  it('keeps thresholds and icons, with a translation key per level', () => {
    expect(LEVEL_THRESHOLDS).toEqual([
      { level: 1, spotsRequired: 0, nameKey: 'levelBeginner', icon: '🌱' },
      { level: 2, spotsRequired: 3, nameKey: 'levelExplorer', icon: '🥈' },
      { level: 3, spotsRequired: 10, nameKey: 'levelMaster', icon: '🥇' },
      { level: 4, spotsRequired: 15, nameKey: 'levelLegend', icon: '⭐' },
      { level: 5, spotsRequired: 20, nameKey: 'levelDiamond', icon: '💎' },
    ]);
  });
});

describe('getSpotsRemainingText', () => {
  const stub: Record<string, string> = {
    maxLevelReached: 'MAX',
    spotsToNextLevel: '{count} to go',
  };
  const t = (key: TranslationKey) => stub[key] ?? key;

  it('uses maxLevelReached at max level', () => {
    expect(getSpotsRemainingText(25, null, t)).toBe('MAX');
  });

  it('interpolates the remaining count', () => {
    expect(getSpotsRemainingText(4, 10, t)).toBe('6 to go');
    expect(getSpotsRemainingText(0, 3, t)).toBe('3 to go');
  });
});
