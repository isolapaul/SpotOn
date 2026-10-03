import { describe, expect, it } from 'vitest';
import {
  getLevelInfo,
  getLevelProgress,
  getLevelThreshold,
  getUserNameColor,
  getXpRemainingText,
  LEVEL_THRESHOLDS,
  levelForSpotCount,
  levelForXp,
  profileLevel,
} from './levelUtils';
import type { TranslationKey } from './translations';
import { interpolate } from './i18n';

const LEVELS = {
  1: { textColor: 'text-emerald-300', bgColor: 'bg-emerald-500/15', borderColor: 'border-emerald-400/30', progressColor: '#34C759', progressBarClass: 'bg-linear-to-r from-[#5EE08A] to-[#0E8A4F]', nameKey: 'levelBeginner', xpRequired: 0, xpForNext: 30, maxHighlights: 0, canCustomizeIcon: false, canCustomizeName: false },
  2: { textColor: 'text-sky-300', bgColor: 'bg-sky-500/15', borderColor: 'border-sky-400/30', progressColor: '#0A84FF', progressBarClass: 'bg-linear-to-r from-[#6FD3FF] to-[#0A64D6]', nameKey: 'levelExplorer', xpRequired: 30, xpForNext: 100, maxHighlights: 0, canCustomizeIcon: false, canCustomizeName: false },
  3: { textColor: 'text-violet-300', bgColor: 'bg-violet-500/15', borderColor: 'border-violet-400/30', progressColor: '#AF52DE', progressBarClass: 'bg-linear-to-r from-[#D59BFF] to-[#6E2FD6]', nameKey: 'levelMaster', xpRequired: 100, xpForNext: 150, maxHighlights: 1, canCustomizeIcon: false, canCustomizeName: false },
  4: { textColor: 'text-orange-300', bgColor: 'bg-orange-500/15', borderColor: 'border-orange-400/30', progressColor: '#FF9F0A', progressBarClass: 'bg-linear-to-r from-[#FFD66B] to-[#FF7A00]', nameKey: 'levelLegend', xpRequired: 150, xpForNext: 200, maxHighlights: 2, canCustomizeIcon: true, canCustomizeName: false },
  5: { textColor: 'text-fuchsia-300', bgColor: 'bg-fuchsia-500/15', borderColor: 'border-fuchsia-400/30', progressColor: '#C084FC', progressBarClass: 'bg-linear-to-r from-[#5EEAD4] via-[#A78BFA] to-[#F472B6]', nameKey: 'levelDiamond', xpRequired: 200, xpForNext: null, maxHighlights: 2, canCustomizeIcon: true, canCustomizeName: true },
} as const;

describe('getLevelInfo', () => {
  it.each([1, 2, 3, 4, 5] as const)('level %i with its styles and XP range', (level) => {
    const expected = LEVELS[level];
    expect(getLevelInfo(level)).toEqual({ level, color: expected.textColor, ...expected });
  });

  it('clamps anything outside 1-5', () => {
    expect(getLevelInfo(0).level).toBe(1);
    expect(getLevelInfo(9).level).toBe(5);
    expect(getLevelInfo(2.5).level).toBe(1);
  });
});

describe('levels from XP and the old spot count', () => {
  it('XP thresholds 30 / 100 / 150 / 200', () => {
    expect([0, 29, 30, 99, 100, 149, 150, 199, 200].map(levelForXp)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5]);
    expect(LEVEL_THRESHOLDS.map((t) => t.xpRequired)).toEqual([0, 30, 100, 150, 200]);
    expect(getLevelThreshold(3)).toBe(100);
    expect(getLevelThreshold(6)).toBe(0);
  });

  it('the old spot-count rule (for profiles not computed yet)', () => {
    expect([0, 2, 3, 9, 10, 14, 15, 19, 20].map(levelForSpotCount)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5]);
  });

  it('a profile: the stored level, else the old rule', () => {
    expect(profileLevel({ level: 3, spotsCount: 20 })).toBe(3);
    expect(profileLevel({ spotsCount: 15 })).toBe(4);
    expect(profileLevel({ level: 7, spotsCount: 0 })).toBe(1);
    expect(profileLevel(null)).toBe(1);
  });
});

describe('progress and remaining text', () => {
  const stub: Record<string, string> = { maxLevelReached: 'MAX', xpToNextLevel: '{count} to go' };
  const t = (key: TranslationKey, vars?: Record<string, string | number>) => interpolate(stub[key] ?? key, vars);

  it('progress within the level; 0 below it (floor), 100 at the top', () => {
    expect(getLevelProgress(65, getLevelInfo(2))).toBe(50);
    expect(getLevelProgress(10, getLevelInfo(4))).toBe(0);
    expect(getLevelProgress(5, getLevelInfo(5))).toBe(100);
  });

  it('remaining XP, or the max-level text', () => {
    expect(getXpRemainingText(65, getLevelInfo(2), t)).toBe('35 to go');
    expect(getXpRemainingText(10, getLevelInfo(4), t)).toBe('190 to go');
    expect(getXpRemainingText(250, getLevelInfo(5), t)).toBe('MAX');
  });
});

describe('getUserNameColor', () => {
  it('the level colour unless an allowlisted custom colour is set', () => {
    expect(getUserNameColor(2)).toBe('#aeb4bf');
    expect(getUserNameColor(1, '#ff0000')).toBe('#cd7f32');
  });
});
