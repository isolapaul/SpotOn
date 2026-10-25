// The running release for /api/health (release automation, docs/BACKLOG.md). Pure.

const RELEASE_TAG = /^v\d+\.\d+\.\d+$/;

/** The image's release tag (`APP_VERSION`, set from the build's VERSION), or 'dev' for anything else. */
export function appVersion(raw: string | undefined): string {
  const value = raw?.trim() ?? '';
  return RELEASE_TAG.test(value) ? value : 'dev';
}
