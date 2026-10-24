import { describe, expect, it } from 'vitest';
import { fillLegalText, LEGAL_MISSING, legalAlternates, legalHref } from './legal';
import { PRIVACY_EN } from '@/content/legal/privacy.en';
import { TERMS_EN } from '@/content/legal/terms.en';
import { PRIVACY_HU } from '@/content/legal/privacy.hu';
import { TERMS_HU } from '@/content/legal/terms.hu';
import { PRIVACY_DE } from '@/content/legal/privacy.de';
import { TERMS_DE } from '@/content/legal/terms.de';

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
  it.each([['privacy hu', PRIVACY_HU], ['terms hu', TERMS_HU], ['privacy en', PRIVACY_EN], ['terms en', TERMS_EN], ['privacy de', PRIVACY_DE], ['terms de', TERMS_DE]] as const)('%s uses only known placeholders', (_, doc) => {
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
});

describe('German translations', () => {
  it.each([[PRIVACY_HU, PRIVACY_DE], [TERMS_HU, TERMS_DE]] as const)('keep the Hungarian structure and dates', (hu, de) => {
    expect(de.lang).toBe('de');
    expect(de.intro.length).toBe(hu.intro.length + 1);
    expect(de.sections.map((s) => s.blocks.length)).toEqual(hu.sections.map((s) => s.blocks.length));
    expect(de.sections.map((s) => s.blocks.map((b) => (typeof b === 'string' ? 0 : b.length)))).toEqual(
      hu.sections.map((s) => s.blocks.map((b) => (typeof b === 'string' ? 0 : b.length))),
    );
    expect(de.sections.map((s) => s.heading.split('.')[0])).toEqual(hu.sections.map((s) => s.heading.split('.')[0]));
    expect(de.intro[0]).toMatch(/maßgeblich ist die ungarische Fassung/);
    // The same date (day and year; the month is written out in each language).
    expect(de.updated.match(/\d+/g)?.sort()).toEqual(hu.updated.match(/\d+/g)?.sort());
  });
});

describe('legal page links', () => {
  it('the UI language picks the page: Hungarian, German, else English', () => {
    expect([legalHref('privacy', 'hu'), legalHref('terms', 'en'), legalHref('terms', 'de'), legalHref('terms', 'fr')])
      .toEqual(['/privacy', '/terms/en', '/terms/de', '/terms/en']);
  });

  it('each page links the other two languages', () => {
    expect(legalAlternates('privacy', 'hu')).toEqual([
      { href: '/privacy/en', label: 'English', lang: 'en' },
      { href: '/privacy/de', label: 'Deutsch', lang: 'de' },
    ]);
    expect(legalAlternates('terms', 'en').map((l) => l.href)).toEqual(['/terms', '/terms/de']);
    expect(legalAlternates('terms', 'de').map((l) => l.label)).toEqual(['Magyar változat', 'English']);
  });
});
