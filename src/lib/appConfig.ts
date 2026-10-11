// The app-wide switches in config/app (growth plan): read by everyone, written by the owner in the
// Firebase console (the rules allow no client writes). Pure parsing and the version check.

export type StorePlatform = 'ios' | 'android';

export interface AppConfig {
  /** The oldest app build still allowed per platform ("2.1.0"); older builds must update. */
  minVersion: Partial<Record<StorePlatform, string>>;
  /** Store pages for the update screen (Android falls back to the Play listing). */
  storeUrl: Partial<Record<StorePlatform, string>>;
  /** Locked pins (give-to-get) are on. */
  lockEnabled: boolean;
  /** The launch challenge runs until this moment (ms); null = the built-in end. */
  launchChallengeEnd: number | null;
}

export const DEFAULT_APP_CONFIG: AppConfig = { minVersion: {}, storeUrl: {}, lockEnabled: false, launchChallengeEnd: null };

export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=hu.isolapaul.spoton';

const VERSION = /^\d+(\.\d+){0,2}$/;

function platformStrings(x: unknown, valid: (s: string) => boolean): Partial<Record<StorePlatform, string>> {
  const out: Partial<Record<StorePlatform, string>> = {};
  if (typeof x !== 'object' || x === null) return out;
  for (const key of ['ios', 'android'] as const) {
    const value = (x as Record<string, unknown>)[key];
    if (typeof value === 'string' && valid(value.trim())) out[key] = value.trim();
  }
  return out;
}

function millis(x: unknown): number | null {
  if (typeof x === 'number' && Number.isFinite(x)) return x;
  if (typeof x === 'object' && x !== null && typeof (x as { toMillis?: unknown }).toMillis === 'function') {
    return (x as { toMillis: () => number }).toMillis();
  }
  return null;
}

/** config/app as stored (missing or malformed fields take the defaults). */
export function parseAppConfig(data: Record<string, unknown> | undefined): AppConfig {
  if (!data) return DEFAULT_APP_CONFIG;
  return {
    minVersion: platformStrings(data.minVersion, (s) => VERSION.test(s)),
    storeUrl: platformStrings(data.storeUrl, (s) => s.startsWith('https://')),
    lockEnabled: data.lockEnabled === true,
    launchChallengeEnd: millis(data.launchChallengeEnd),
  };
}

/** -1, 0 or 1, comparing dotted versions numerically ("2.10.0" > "2.9.1"). */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d < 0 ? -1 : 1;
  }
  return 0;
}

/** Whether this app build is older than the platform's minimum (never for the web). */
export function updateRequired(config: AppConfig, platform: StorePlatform | null, version: string): boolean {
  if (!platform || !VERSION.test(version)) return false;
  const min = config.minVersion[platform];
  return !!min && compareVersions(version, min) < 0;
}

/** Where the update screen sends the user. */
export function storeUrlFor(config: AppConfig, platform: StorePlatform): string | null {
  return config.storeUrl[platform] ?? (platform === 'android' ? PLAY_STORE_URL : null);
}
