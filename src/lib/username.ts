// Pure username helpers (T11a). Mirrors functions/src/lib/profiles.ts (USERNAME_RE / normalizeUsername).

export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

/** Trim + lowercase. */
export function normalizeUsername(s: string): string {
  return s.trim().toLowerCase();
}

/** True when the normalized name matches USERNAME_RE. */
export function isValidUsername(s: string): boolean {
  return USERNAME_RE.test(normalizeUsername(s));
}

/** Generate a username from a display name (base of up to 12 [a-z0-9] chars + numeric suffix). */
export function generateUsername(displayName: string, rand: () => number = Math.random): string {
  const base = displayName
    .toLowerCase()
    .replaceAll(/[^a-z0-9]/g, '')
    .slice(0, 12);
  const suffix = Math.floor(rand() * 1000000);
  return `${base || 'user'}${suffix}`;
}
