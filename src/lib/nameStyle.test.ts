import { describe, expect, it } from 'vitest';
import { NAME_COLORS, NAME_FONTS, resolveNameColorHex, resolveNameFontClass } from './nameStyle';
import { CUSTOM_NAME_COLORS, CUSTOM_NAME_FONTS, getCustomNameColorValue, getUserNameColor } from './levelUtils';

const HOSTILE: unknown[] = ['fixed inset-0 z-[9999]', '#ff0000', '__proto__', 'constructor', 'toString', undefined, null, 123, {}, ''];

describe('resolveNameFontClass', () => {
  it('resolves every allowlisted font to its static class', () => {
    for (const [value, entry] of Object.entries(NAME_FONTS)) {
      expect(resolveNameFontClass(value)).toBe(entry.className);
      expect(entry.className).toBe(value);
    }
  });

  it.each(HOSTILE)('falls back to font-sans for %j', (value) => {
    expect(resolveNameFontClass(value)).toBe('font-sans');
  });
});

describe('resolveNameColorHex', () => {
  it('resolves every allowlisted colour to its hex', () => {
    for (const [value, entry] of Object.entries(NAME_COLORS)) {
      expect(resolveNameColorHex(value)).toBe(entry.hex);
      expect(entry.hex).toMatch(/^#[0-9a-f]{6}$/);
      expect(entry.textClass).toBe(value);
    }
  });

  it.each(HOSTILE)('returns undefined for %j', (value) => {
    expect(resolveNameColorHex(value)).toBeUndefined();
  });

  it('keeps the hex values used before T22', () => {
    expect(Object.fromEntries(Object.entries(NAME_COLORS).map(([k, v]) => [k, v.hex]))).toEqual({
      'text-cyan-300': '#67e8f9',
      'text-purple-400': '#c084fc',
      'text-emerald-400': '#34d399',
      'text-rose-400': '#fb7185',
      'text-yellow-300': '#fde047',
      'text-slate-300': '#cbd5e1',
      'text-orange-400': '#fb923c',
    });
  });
});

describe('selected-state classes', () => {
  it('are the static bg/border pair of the text colour', () => {
    for (const [value, entry] of Object.entries(NAME_COLORS)) {
      const colour = value.slice('text-'.length);
      expect(entry.selectedClass).toBe(`bg-${colour}/20 border-2 border-${colour}`);
    }
  });
});

describe('picker lists (levelUtils)', () => {
  it('keep the stored values and their order', () => {
    expect(CUSTOM_NAME_COLORS.map((c) => c.value)).toEqual([
      'text-cyan-300', 'text-purple-400', 'text-emerald-400', 'text-rose-400',
      'text-yellow-300', 'text-slate-300', 'text-orange-400',
    ]);
    expect(CUSTOM_NAME_FONTS.map((f) => f.value)).toEqual([
      'font-sans', 'font-bold', 'font-serif', 'font-mono', 'font-serif italic', 'font-extrabold', 'font-light italic',
    ]);
  });
});

describe('getCustomNameColorValue / getUserNameColor', () => {
  it('no longer honour raw colour strings (SEC-05)', () => {
    expect(getCustomNameColorValue('#ff0000')).toBeUndefined();
    expect(getCustomNameColorValue('rgb(255, 0, 0)')).toBeUndefined();
    expect(getCustomNameColorValue('hsl(0, 100%, 50%)')).toBeUndefined();
  });

  it('use an allowlisted custom colour, else the level colour', () => {
    expect(getUserNameColor(25, 'text-rose-400')).toBe('#fb7185');
    expect(getUserNameColor(25, '#ff0000')).toBe('#06b6d4');
    expect(getUserNameColor(0, 'expression(alert(1))')).toBe('#cd7f32');
    expect(getUserNameColor(3)).toBe('#aeb4bf');
    expect(getUserNameColor(10)).toBe('#f5c542');
    expect(getUserNameColor(15)).toBe('#f5c542');
    expect(getUserNameColor(20)).toBe('#06b6d4');
  });
});
