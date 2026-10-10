import { describe, expect, it } from 'vitest';
import { offlineHtml, offlineLanguage } from './offlinePage';

describe('offline page', () => {
  it('follows the device language, Hungarian by default', () => {
    expect(offlineLanguage('de-AT')).toBe('de');
    expect(offlineLanguage('en')).toBe('en');
    expect(offlineLanguage('fr-FR')).toBe('hu');
    expect(offlineLanguage(undefined)).toBe('hu');
  });
  it('is a static page with a way back to the app', () => {
    const html = offlineHtml('en-GB');
    expect(html).toContain('lang="en"');
    expect(html).toContain('You are offline');
    expect(html).toContain('href="/"');
    expect(html).not.toContain('<script');
  });
});
