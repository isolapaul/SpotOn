import { describe, expect, it } from 'vitest';
import { compareVersions, DEFAULT_APP_CONFIG, parseAppConfig, PLAY_STORE_URL, storeUrlFor, updateRequired } from './appConfig';

describe('appConfig', () => {
  it('parses the stored doc defensively', () => {
    expect(parseAppConfig(undefined)).toEqual(DEFAULT_APP_CONFIG);
    expect(parseAppConfig({
      minVersion: { ios: ' 2.2.0 ', android: 'latest' },
      storeUrl: { ios: 'https://apps.apple.com/app/id1', android: 'http://x' },
      lockEnabled: 'yes',
      launchChallengeEnd: { toMillis: () => 5 },
    })).toEqual({ minVersion: { ios: '2.2.0' }, storeUrl: { ios: 'https://apps.apple.com/app/id1' }, lockEnabled: false, lockOpenCount: 30, launchChallengeEnd: 5 });
    expect(parseAppConfig({ lockOpenCount: 0 }).lockOpenCount).toBe(0);
    expect(parseAppConfig({ lockOpenCount: -1 }).lockOpenCount).toBe(30);
    expect(parseAppConfig({ lockEnabled: true }).lockEnabled).toBe(true);
  });
  it('compares versions numerically', () => {
    expect(compareVersions('2.10.0', '2.9.1')).toBe(1);
    expect(compareVersions('2.1', '2.1.0')).toBe(0);
    expect(compareVersions('2.0.9', '2.1.0')).toBe(-1);
  });
  it('asks only old app builds to update', () => {
    const config = parseAppConfig({ minVersion: { android: '2.2.0' } });
    expect(updateRequired(config, 'android', '2.1.0')).toBe(true);
    expect(updateRequired(config, 'android', '2.2.0')).toBe(false);
    expect(updateRequired(config, 'ios', '2.1.0')).toBe(false);
    expect(updateRequired(config, null, '1.0.0')).toBe(false);
  });
  it('falls back to the Play listing', () => {
    expect(storeUrlFor(DEFAULT_APP_CONFIG, 'android')).toBe(PLAY_STORE_URL);
    expect(storeUrlFor(DEFAULT_APP_CONFIG, 'ios')).toBeNull();
  });
});
