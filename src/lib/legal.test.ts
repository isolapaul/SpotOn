import { describe, expect, it } from 'vitest';
import { fillLegalText, LEGAL_MISSING, legalHref } from './legal';
import { PRIVACY_EN } from '@/content/legal/privacy.en';
import { TERMS_EN } from '@/content/legal/terms.en';
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
  it.each([['privacy hu', PRIVACY_HU], ['terms hu', TERMS_HU], ['privacy en', PRIVACY_EN], ['terms en', TERMS_EN]] as const)('%s uses only known placeholders', (_, doc) => {
    const text = JSON.stringify(doc);
    const placeholders = new Set(text.match(/\{[a-z]+\}/g) ?? []);
    expect([...placeholders].sort()).toEqual(['{controller}', '{email}']);
  });
});

describe('English translations (item 9)', () => {
  it.each([[PRIVACY_HU, PRIVACY_EN], [TERMS_HU, TERMS_EN]] as const)('keep the Hungarian structure', (hu, en) => {
    expect(en.sections.map((s) => s.blocks.length)).toEqual(hu.sections.map((s) => s.blocks.length));
    expect(en.sections.map((s) => s.heading.split('.')[0])).toEqual(hu.sections.map((s) => s.heading.split('.')[0]));
    expect(en.intro[0]).toMatch(/Hungarian version is authoritative/);
  });
  it('the UI language picks the page: Hungarian, else English', () => {
    expect([legalHref('privacy', 'hu'), legalHref('terms', 'en'), legalHref('terms', 'de')]).toEqual(['/privacy', '/terms/en', '/terms/en']);
  });
});
