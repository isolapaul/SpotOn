import { afterEach, describe, expect, it, vi } from 'vitest';
import { getNavigationUrl, getPlatform } from './spotUtils';

const setUserAgent = (userAgent: string) => vi.stubGlobal('navigator', { userAgent });

describe('getPlatform / getNavigationUrl', () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', 'ios'],
    ['Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X)', 'ios'],
    ['Mozilla/5.0 (iPod touch; CPU iPhone OS 12_0 like Mac OS X)', 'ios'],
    ['Mozilla/5.0 (Linux; Android 14; Pixel 8)', 'android'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'desktop'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)', 'desktop'],
  ])('%s → %s', (ua, platform) => {
    setUserAgent(ua);
    expect(getPlatform()).toBe(platform);
  });

  it('uses Apple Maps on iOS', () => {
    setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)');
    expect(getNavigationUrl(47.5, 19.04)).toBe('maps://maps.apple.com/?q=47.5,19.04');
  });

  it('uses Google Maps directions elsewhere', () => {
    setUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8)');
    expect(getNavigationUrl(-33.8, 151.2)).toBe('https://www.google.com/maps/dir/?api=1&destination=-33.8,151.2');
    setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
    expect(getNavigationUrl(0, 0)).toBe('https://www.google.com/maps/dir/?api=1&destination=0,0');
  });
});
