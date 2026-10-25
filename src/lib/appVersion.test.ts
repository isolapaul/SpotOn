import { describe, expect, it } from 'vitest';
import { appVersion } from './appVersion';

describe('appVersion', () => {
  it('passes a release tag through', () => {
    expect(appVersion('v2.3.1')).toBe('v2.3.1');
    expect(appVersion(' v10.0.12\n')).toBe('v10.0.12');
  });

  it('is dev without a release tag', () => {
    expect(appVersion(undefined)).toBe('dev');
    expect(appVersion('')).toBe('dev');
    expect(appVersion('dev')).toBe('dev');
    expect(appVersion('2.3.1')).toBe('dev');
    expect(appVersion('v2.3')).toBe('dev');
    expect(appVersion('v2.3.1-rc.1')).toBe('dev');
    expect(appVersion('<script>')).toBe('dev');
  });
});
