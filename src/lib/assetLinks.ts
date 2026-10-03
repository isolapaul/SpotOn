// Digital Asset Links for the Android app (Trusted Web Activity). Pure: no React, Firebase or DOM.

/** The Play package name. Permanent: Google Play never allows it to change. */
export const ANDROID_PACKAGE_NAME = 'hu.isolapaul.spoton';

const FINGERPRINT = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;

/**
 * The SHA-256 certificate fingerprints from a comma-separated setting (Play App Signing key, optionally
 * the upload key), normalised to upper case; malformed entries are dropped.
 */
export function parseFingerprints(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter((s) => FINGERPRINT.test(s));
}

/** The /.well-known/assetlinks.json statement list; empty when no fingerprint is configured. */
export function buildAssetLinks(fingerprints: readonly string[]) {
  if (fingerprints.length === 0) return [];
  return [
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: { namespace: 'android_app', package_name: ANDROID_PACKAGE_NAME, sha256_cert_fingerprints: [...fingerprints] },
    },
  ];
}
