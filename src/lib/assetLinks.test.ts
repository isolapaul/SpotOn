import { describe, expect, it } from 'vitest';
import { ANDROID_PACKAGE_NAME, buildAssetLinks, parseFingerprints } from './assetLinks';

const FP = Array.from({ length: 32 }, (_, i) => i.toString(16).padStart(2, '0')).join(':');

describe('parseFingerprints', () => {
  it('reads comma-separated fingerprints, upper-cased and trimmed', () => {
    expect(parseFingerprints(` ${FP} , ${FP.toUpperCase()}`)).toEqual([FP.toUpperCase(), FP.toUpperCase()]);
  });
  it('drops malformed entries and handles an unset value', () => {
    expect(parseFingerprints('AB:CD, not-a-fingerprint,')).toEqual([]);
    expect(parseFingerprints(undefined)).toEqual([]);
  });
});

describe('buildAssetLinks', () => {
  it('is empty without fingerprints', () => {
    expect(buildAssetLinks([])).toEqual([]);
  });
  it('delegates all URLs to the Play package', () => {
    expect(buildAssetLinks([FP.toUpperCase()])).toEqual([
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: { namespace: 'android_app', package_name: ANDROID_PACKAGE_NAME, sha256_cert_fingerprints: [FP.toUpperCase()] },
      },
    ]);
  });
});
