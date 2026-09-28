import { describe, expect, it } from 'vitest';
import { fillLegalText, LEGAL_MISSING } from './legal';
import { PRIVACY_HU } from '@/content/legal/privacy.hu';
import { TERMS_HU } from '@/content/legal/terms.hu';

describe('fillLegalText', () => {
  it('fills every placeholder', () => {
    expect(fillLegalText('{controller} <{email}>, {email}', { controller: 'Kiss Pál', email: 'a@b.hu' }))
      .toBe('Kiss Pál <a@b.hu>, a@b.hu');
  });

  it('marks a missing value visibly', () => {
    expect(fillLegalText('{controller} {email}', { controller: ' ' })).toBe(`${LEGAL_MISSING} ${LEGAL_MISSING}`);
  });
});

describe('legal documents', () => {
  it.each([['privacy', PRIVACY_HU], ['terms', TERMS_HU]] as const)('%s uses only known placeholders', (_, doc) => {
    const text = JSON.stringify(doc);
    const placeholders = new Set(text.match(/\{[a-z]+\}/g) ?? []);
    expect([...placeholders].sort()).toEqual(['{controller}', '{email}']);
  });
});
