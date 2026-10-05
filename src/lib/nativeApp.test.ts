import { describe, expect, it } from 'vitest';
import { appLinkPath, isNativeApp, nativePlatform } from './nativeApp';

const native = (platform: string) => ({ Capacitor: { isNativePlatform: () => true, getPlatform: () => platform } });

describe('isNativeApp', () => {
  it('is true only when the native bridge says so', () => {
    expect(isNativeApp(native('android'))).toBe(true);
    expect(isNativeApp({ Capacitor: { isNativePlatform: () => false, getPlatform: () => 'web' } })).toBe(false);
    expect(isNativeApp({ Capacitor: {} })).toBe(false);
    expect(isNativeApp({})).toBe(false);
  });

  it('is false in the test runner (no bridge)', () => {
    expect(isNativeApp()).toBe(false);
  });
});

describe('nativePlatform', () => {
  it('names the platform inside the app', () => {
    expect(nativePlatform(native('android'))).toBe('android');
    expect(nativePlatform(native('ios'))).toBe('ios');
  });

  it('is null in a browser or for an unknown platform', () => {
    expect(nativePlatform({})).toBeNull();
    expect(nativePlatform(native('electron'))).toBeNull();
    expect(nativePlatform({ Capacitor: { isNativePlatform: () => true } })).toBeNull();
  });
});

describe('appLinkPath', () => {
  const origin = 'https://spoton.isolapaul.hu';

  it('keeps the path, query and hash of an own link', () => {
    expect(appLinkPath('https://spoton.isolapaul.hu/spot/abc123', origin)).toBe('/spot/abc123');
    expect(appLinkPath('https://spoton.isolapaul.hu/?x=1#top', origin)).toBe('/?x=1#top');
  });

  it('ignores other sites and unparsable links', () => {
    expect(appLinkPath('https://evil.example/spot/abc', origin)).toBeNull();
    expect(appLinkPath('http://spoton.isolapaul.hu/spot/abc', origin)).toBeNull();
    expect(appLinkPath('not a url', origin)).toBeNull();
  });
});
