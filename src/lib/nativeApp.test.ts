import { describe, expect, it } from 'vitest';
import { appLinkPath, isNativeApp, isSignInCancelled, SIGN_IN_CANCELLED } from './nativeApp';

const native = () => ({ Capacitor: { isNativePlatform: () => true } });

describe('isNativeApp', () => {
  it('is true only when the native bridge says so', () => {
    expect(isNativeApp(native())).toBe(true);
    expect(isNativeApp({ Capacitor: { isNativePlatform: () => false } })).toBe(false);
    expect(isNativeApp({ Capacitor: {} })).toBe(false);
    expect(isNativeApp({})).toBe(false);
  });

  it('is false in the test runner (no bridge)', () => {
    expect(isNativeApp()).toBe(false);
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

describe('isSignInCancelled', () => {
  it('recognises only the native cancel code', () => {
    expect(isSignInCancelled(Object.assign(new Error('x'), { code: SIGN_IN_CANCELLED }))).toBe(true);
    expect(isSignInCancelled(Object.assign(new Error('x'), { code: 'auth/popup-closed-by-user' }))).toBe(false);
    expect(isSignInCancelled(new Error('x'))).toBe(false);
    expect(isSignInCancelled(null)).toBe(false);
  });
});
