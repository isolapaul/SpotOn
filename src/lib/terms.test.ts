import { describe, expect, it } from 'vitest';
import { needsTermsAcceptance, TERMS_VERSION } from './terms';

describe('needsTermsAcceptance', () => {
  it('never accepted (legacy users doc): asked', () => {
    expect(needsTermsAcceptance(undefined)).toBe(true);
  });

  it('an older version: asked again', () => {
    expect(needsTermsAcceptance('2000-01-01')).toBe(true);
  });

  it('the current version: not asked', () => {
    expect(needsTermsAcceptance(TERMS_VERSION)).toBe(false);
  });
});
