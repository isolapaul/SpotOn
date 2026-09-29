import { describe, expect, it } from 'vitest';
import { LEVEL_PERKS, LEVEL_THEMES, levelTheme, levelUpStep } from './levelTheme';
import { glyphToSvgMarkup } from './categoryGlyphs';

describe('levelTheme', () => {
  it('gives every level its own colours and glyph', () => {
    const accents = new Set(Object.values(LEVEL_THEMES).map((t) => t.accent));
    const glyphs = new Set(Object.values(LEVEL_THEMES).map((t) => glyphToSvgMarkup(t.glyph, '#fff')));
    expect(accents.size).toBe(5);
    expect(glyphs.size).toBe(5);
  });

  it('clamps out-of-range levels', () => {
    expect(levelTheme(0)).toBe(LEVEL_THEMES[1]);
    expect(levelTheme(9)).toBe(LEVEL_THEMES[5]);
    expect(levelTheme(3)).toBe(LEVEL_THEMES[3]);
  });
});

describe('LEVEL_PERKS', () => {
  it('lists perks for every level without emoji', () => {
    for (const level of [1, 2, 3, 4, 5] as const) {
      expect(LEVEL_PERKS[level].length).toBeGreaterThan(0);
      for (const perk of LEVEL_PERKS[level]) expect(perk.keys.join(' ')).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });
});

describe('levelUpStep', () => {
  it('records the first sighting without celebrating', () => {
    expect(levelUpStep(null, 3)).toEqual({ celebrate: false, next: 3 });
  });

  it('celebrates a level above the highest seen', () => {
    expect(levelUpStep(2, 3)).toEqual({ celebrate: true, next: 3 });
  });

  it('never celebrates or lowers on a partial load (a lower level)', () => {
    expect(levelUpStep(3, 1)).toEqual({ celebrate: false, next: 3 });
    expect(levelUpStep(3, 3)).toEqual({ celebrate: false, next: 3 });
  });
});
