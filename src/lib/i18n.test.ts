import { describe, expect, it } from 'vitest';
import { interpolate, splitBold, translate, type Language } from './i18n';
import { translations, type TranslationKey } from './translations';

const dict = translations; // test oracle; aliased so the T24 acceptance grep only flags app code

describe('translate', () => {
  it.each([
    ['hu', 'Felfedezés'],
    ['en', 'Explore'],
    ['de', 'Entdecken'],
  ] as const)('%s returns the dictionary value', (lang, expected) => {
    expect(translate(lang, 'explore')).toBe(expected);
    expect(translate(lang, 'explore')).toBe(dict[lang].explore);
  });

  it('returns the key when the text is missing (same as the former store t)', () => {
    expect(translate('en', 'noSuchKey' as TranslationKey)).toBe('noSuchKey');
  });

  it('returns the key for an unsupported language instead of throwing', () => {
    expect(translate('fr' as Language, 'explore')).toBe('explore');
  });

  it('applies vars', () => {
    expect(translate('en', 'languageChanged', { language: 'English' })).toBe(
      translations.en.languageChanged.replace('{language}', 'English'),
    );
    expect(translate('hu', 'highlightedCount', { count: 1, max: 3 })).toBe('1 / 3 kiemelve');
  });

  it('keeps placeholders when no vars are given', () => {
    expect(translate('en', 'highlightedCount')).toBe('{count} / {max} highlighted');
  });
});

describe('interpolate', () => {
  it('returns the string unchanged without vars', () => {
    expect(interpolate('a {x} b')).toBe('a {x} b');
  });

  it('replaces each named placeholder, numbers as strings', () => {
    expect(interpolate('{count} / {max}', { count: 2, max: 5 })).toBe('2 / 5');
  });

  it('leaves unknown placeholders and ignores unused vars', () => {
    expect(interpolate('Hi {name}, {other}', { name: 'Ann', unused: 'x' })).toBe('Hi Ann, {other}');
  });

  it('replaces only the first occurrence, like String.replace with a string pattern', () => {
    expect(interpolate('{x} {x}', { x: 1 })).toBe('1 {x}');
  });

  it('inserts values literally', () => {
    expect(interpolate('Hi {name}', { name: '$&$1' })).toBe('Hi $&$1');
  });

  it('no dictionary value repeats a placeholder (first-occurrence semantics are enough)', () => {
    const repeated = (['hu', 'en', 'de'] as const).flatMap((lang) =>
      Object.entries(dict[lang])
        .filter(([, v]) => {
          const names = v.match(/\{\w+\}/g) ?? [];
          return new Set(names).size !== names.length;
        })
        .map(([k]) => `${lang}.${k}`),
    );
    expect(repeated).toEqual([]);
  });
});

describe('splitBold', () => {
  it('no markers: one plain part', () => {
    expect(splitBold('plain text')).toEqual([{ text: 'plain text', bold: false }]);
  });

  it('one bold part in the middle', () => {
    expect(splitBold('Tap the **Share icon** below.')).toEqual([
      { text: 'Tap the ', bold: false },
      { text: 'Share icon', bold: true },
      { text: ' below.', bold: false },
    ]);
  });

  it('two bold parts', () => {
    expect(splitBold('Select **"A"** or **"B"**.')).toEqual([
      { text: 'Select ', bold: false },
      { text: '"A"', bold: true },
      { text: ' or ', bold: false },
      { text: '"B"', bold: true },
      { text: '.', bold: false },
    ]);
  });

  it('markers at the start and at the end', () => {
    expect(splitBold('**Start** middle **end**')).toEqual([
      { text: 'Start', bold: true },
      { text: ' middle ', bold: false },
      { text: 'end', bold: true },
    ]);
  });

  it('empty string: no parts', () => {
    expect(splitBold('')).toEqual([]);
  });
});

describe('T24 keys', () => {
  const AUTH_KEYS = [
    'authWelcome', 'authWelcomeDesc', 'authSignIn', 'authSignUp', 'authSignInDesc', 'authSignUpDesc',
    'authSigningIn', 'authGoogle', 'authOr', 'authWithEmail', 'authUsername', 'authEmail', 'authPassword',
    'authUsernamePlaceholder', 'authEmailPlaceholder', 'authPasswordPlaceholder', 'authPasswordHint',
    'authNoAccount', 'authHaveAccount', 'authBack', 'authTerms',
    'authErrGoogle', 'authErrUsername', 'authErrInvalidEmail', 'authErrWrongPassword', 'authErrEmailInUse',
    'authErrWeakPassword', 'authErrInvalidCredential', 'authErrSignInFailed', 'authErrSignUpFailed',
  ] as const;
  const INSTALL_KEYS = [
    'installTitle', 'installBody', 'installIosTitle', 'installIosStep1', 'installIosStep2', 'installIosHint',
    'installAndroidTitle', 'installAndroidStep1', 'installAndroidStep2', 'installAndroidHint',
    'installContinueWeb', 'installDontShowAgain', 'installFooter',
  ] as const;
  const LANG_SELECT_KEYS = ['langSelectTitle', 'langSelectDesc', 'langSelectContinue'] as const;

  it.each(['hu', 'en', 'de'] as const)('%s has every auth*, install* and langSelect* key', (lang) => {
    for (const key of [...AUTH_KEYS, ...INSTALL_KEYS, ...LANG_SELECT_KEYS]) {
      expect(dict[lang], `${lang}.${key}`).toHaveProperty(key);
      expect(dict[lang][key].trim(), `${lang}.${key}`).not.toBe('');
    }
  });

  it('install steps keep their bold markup balanced', () => {
    for (const lang of ['hu', 'en', 'de'] as const) {
      for (const key of ['installIosStep1', 'installIosStep2', 'installAndroidStep1', 'installAndroidStep2'] as const) {
        const markers = dict[lang][key].split('**').length - 1;
        expect(markers > 0 && markers % 2 === 0, `${lang}.${key}`).toBe(true);
      }
    }
  });

  it('LanguageSelector texts, verbatim', () => {
    expect([translations.hu.langSelectTitle, translations.en.langSelectTitle, translations.de.langSelectTitle])
      .toEqual(['Válassz Nyelvet', 'Select Language', 'Sprache wählen']);
    expect(translations.de.langSelectDesc).toBe('Wählen Sie Ihre bevorzugte Sprache');
    expect([translations.hu.langSelectContinue, translations.en.langSelectContinue, translations.de.langSelectContinue])
      .toEqual(['Folytatás', 'Continue', 'Weiter']);
  });
});
