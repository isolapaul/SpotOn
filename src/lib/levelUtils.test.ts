import { describe, expect, it } from 'vitest';
import { getLevelInfo, getLevelThreshold, getSpotsRemainingText, LEVEL_THRESHOLDS } from './levelUtils';
import { profileLevelSpots } from './__oracles__/legacy';
import type { TranslationKey } from './translations';
import { interpolate } from './i18n';

// Values of getLevelInfo before T22 (only `name` became `nameKey`; progressBarClass is new).
const LEVELS = {
  1: { textColor: 'text-emerald-300', bgColor: 'bg-emerald-500/15', borderColor: 'border-emerald-400/30', progressColor: '#34C759', progressBarClass: 'bg-gradient-to-r from-[#5EE08A] to-[#0E8A4F]', nameKey: 'levelBeginner', spotsRequired: 0, spotsForNext: 3, maxHighlights: 0, canCustomizeIcon: false, canCustomizeName: false },
  2: { textColor: 'text-sky-300', bgColor: 'bg-sky-500/15', borderColor: 'border-sky-400/30', progressColor: '#0A84FF', progressBarClass: 'bg-gradient-to-r from-[#6FD3FF] to-[#0A64D6]', nameKey: 'levelExplorer', spotsRequired: 3, spotsForNext: 10, maxHighlights: 0, canCustomizeIcon: false, canCustomizeName: false },
  3: { textColor: 'text-violet-300', bgColor: 'bg-violet-500/15', borderColor: 'border-violet-400/30', progressColor: '#AF52DE', progressBarClass: 'bg-gradient-to-r from-[#D59BFF] to-[#6E2FD6]', nameKey: 'levelMaster', spotsRequired: 10, spotsForNext: 15, maxHighlights: 1, canCustomizeIcon: false, canCustomizeName: false },
  4: { textColor: 'text-orange-300', bgColor: 'bg-orange-500/15', borderColor: 'border-orange-400/30', progressColor: '#FF9F0A', progressBarClass: 'bg-gradient-to-r from-[#FFD66B] to-[#FF7A00]', nameKey: 'levelLegend', spotsRequired: 15, spotsForNext: 20, maxHighlights: 2, canCustomizeIcon: true, canCustomizeName: false },
  5: { textColor: 'text-fuchsia-300', bgColor: 'bg-fuchsia-500/15', borderColor: 'border-fuchsia-400/30', progressColor: '#C084FC', progressBarClass: 'bg-gradient-to-r from-[#5EEAD4] via-[#A78BFA] to-[#F472B6]', nameKey: 'levelDiamond', spotsRequired: 20, spotsForNext: null, maxHighlights: 2, canCustomizeIcon: true, canCustomizeName: true },
} as const;

const CASES: Array<[number, keyof typeof LEVELS]> = [
  [0, 1], [2, 1], [3, 2], [9, 2], [10, 3], [14, 3], [15, 4], [19, 4], [20, 5], [100, 5],
];

describe('getLevelInfo', () => {
  it.each(CASES)('%i spots → level %i with its level styles', (count, level) => {
    const expected = LEVELS[level];
    expect(getLevelInfo(count)).toEqual({ level, color: expected.textColor, ...expected });
  });

  it('has a static gradient progressBarClass for every level', () => {
    for (const count of [0, 3, 10, 15, 20]) {
      expect(getLevelInfo(count).progressBarClass).toMatch(/^bg-gradient-to-r from-\[#[0-9A-F]{6}\]( via-\[#[0-9A-F]{6}\])? to-\[#[0-9A-F]{6}\]$/);
    }
  });
});

describe('LEVEL_THRESHOLDS', () => {
  it('keeps thresholds, with a translation key per level', () => {
    expect(LEVEL_THRESHOLDS).toEqual([
      { level: 1, spotsRequired: 0, nameKey: 'levelBeginner' },
      { level: 2, spotsRequired: 3, nameKey: 'levelExplorer' },
      { level: 3, spotsRequired: 10, nameKey: 'levelMaster' },
      { level: 4, spotsRequired: 15, nameKey: 'levelLegend' },
      { level: 5, spotsRequired: 20, nameKey: 'levelDiamond' },
    ]);
  });
});

describe('getSpotsRemainingText', () => {
  const stub: Record<string, string> = {
    maxLevelReached: 'MAX',
    spotsToNextLevel: '{count} to go',
  };
  const t = (key: TranslationKey, vars?: Record<string, string | number>) => interpolate(stub[key] ?? key, vars);

  it('uses maxLevelReached at max level', () => {
    expect(getSpotsRemainingText(25, null, t)).toBe('MAX');
  });

  it('interpolates the remaining count', () => {
    expect(getSpotsRemainingText(4, 10, t)).toBe('6 to go');
    expect(getSpotsRemainingText(0, 3, t)).toBe('3 to go');
  });
});

describe('getLevelThreshold (characterisation vs ProfilePanel [0, 0, 3, 10, 15, 20][level])', () => {
  it.each([1, 2, 3, 4, 5])('level %i', (level) => {
    expect(getLevelThreshold(level)).toBe(profileLevelSpots[level]);
  });

  it('returns 0 outside 1-5', () => {
    expect(getLevelThreshold(0)).toBe(0);
    expect(getLevelThreshold(6)).toBe(0);
  });
});
