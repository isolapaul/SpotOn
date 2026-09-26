import { describe, expect, it } from 'vitest';
import { isBannerDismissed, movedTarget, parseMovedTo } from './movedTo';

describe('parseMovedTo', () => {
  it('returns null for unset, empty, non-https or malformed values', () => {
    expect(parseMovedTo(undefined)).toBeNull();
    expect(parseMovedTo('')).toBeNull();
    expect(parseMovedTo('http://x')).toBeNull();
    expect(parseMovedTo('not a url')).toBeNull();
  });

  it('returns a URL for an https address', () => {
    const url = parseMovedTo('https://spoton.isolapaul.hu');
    expect(url).toBeInstanceOf(URL);
    expect(url?.host).toBe('spoton.isolapaul.hu');
  });
});

describe('isBannerDismissed', () => {
  it('is false when nothing is stored', () => {
    expect(isBannerDismissed(null)).toBe(false);
  });

  it("is true only for '1'", () => {
    expect(isBannerDismissed('1')).toBe(true);
  });

  it('is false for any other value, including a timestamp', () => {
    for (const v of ['', '0', 'true', '1700000000000']) {
      expect(isBannerDismissed(v)).toBe(false);
    }
  });
});

describe('movedTarget', () => {
  it('keeps the path and query', () => {
    const base = new URL('https://spoton.isolapaul.hu');
    expect(movedTarget(base, '/some/path', '?x=1&y=2')).toBe('https://spoton.isolapaul.hu/some/path?x=1&y=2');
    expect(movedTarget(base, '/', '')).toBe('https://spoton.isolapaul.hu/');
  });

  it('never leaves the base origin', () => {
    const base = new URL('https://spoton.isolapaul.hu');
    expect(movedTarget(base, '//evil.example/x', '')).toBe('https://spoton.isolapaul.hu/');
  });
});
