import { describe, expect, it } from 'vitest';
import { coverRect, wrapLines } from './shareCard';

const measure = (s: string) => s.length * 10;

describe('wrapLines', () => {
  it('wraps words into lines', () => {
    expect(wrapLines('a bb ccc dddd', 70, 3, measure)).toEqual(['a bb', 'ccc', 'dddd']);
  });
  it('ends the last line with an ellipsis when text is left', () => {
    expect(wrapLines('one two three four five six', 90, 2, measure)).toEqual(['one two', 'three…']);
  });
  it('cuts a single word that is too long', () => {
    expect(wrapLines('supercalifragilistic', 80, 2, measure)).toEqual(['superca…']);
  });
  it('handles empty text', () => {
    expect(wrapLines('  ', 80, 2, measure)).toEqual([]);
  });
});

describe('coverRect', () => {
  it('crops the sides of a wide image', () => {
    expect(coverRect(2000, 1000, 1000, 1000)).toEqual({ sx: 500, sy: 0, sw: 1000, sh: 1000 });
  });
  it('crops the top and bottom of a tall image', () => {
    expect(coverRect(1000, 4000, 1000, 2000)).toEqual({ sx: 0, sy: 1000, sw: 1000, sh: 2000 });
  });
});
