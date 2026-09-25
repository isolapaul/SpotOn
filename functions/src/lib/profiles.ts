/**
 * Pure helpers for public profiles, usernames and name styles (T09).
 * No Firebase imports: shared by the Cloud Functions and scripts/backfill-profiles.ts.
 * The only import is the sibling pure module ./levels (itself import-free), which holds the
 * name-style allowlists.
 */
import {NAME_COLORS, NAME_FONTS} from "./levels";

/** Lowercase a-z, 0-9 and _; 3–20 characters. */
export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

/** Trim + lowercase; the result if it matches USERNAME_RE, else null. */
export function normalizeUsername(x: unknown): string | null {
  if (typeof x !== "string") return null;
  const name = x.trim().toLowerCase();
  return USERNAME_RE.test(name) ? name : null;
}

export class NameStyleValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NameStyleValidationError";
  }
}

export interface NameStylePatch {
  color?: string | null;
  font?: string | null;
}

const NAME_STYLE_ALLOWLISTS: Record<keyof NameStylePatch, readonly string[]> = {
  color: NAME_COLORS,
  font: NAME_FONTS,
};

function isPlainObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

/**
 * Accepts an object whose keys are a non-empty subset of {color, font}; each value is null
 * (clear) or a member of its allowlist. Throws NameStyleValidationError otherwise.
 */
export function validateNameStylePatch(data: unknown): NameStylePatch {
  if (!isPlainObject(data)) {
    throw new NameStyleValidationError("Name style must be an object");
  }
  const keys = Object.keys(data);
  if (keys.length === 0) {
    throw new NameStyleValidationError("Name style must set color and/or font");
  }
  const patch: NameStylePatch = {};
  for (const key of keys) {
    if (key !== "color" && key !== "font") {
      throw new NameStyleValidationError("Unknown name style field");
    }
    const value = data[key];
    if (value !== null && !(typeof value === "string" && NAME_STYLE_ALLOWLISTS[key].includes(value))) {
      throw new NameStyleValidationError("Name style value is not allowed");
    }
    patch[key] = value as string | null;
  }
  return patch;
}

export interface PublicProfile {
  username: string | null;
  profilePictureURL: string | null;
  customNameColor: string | null;
  customNameFont: string | null;
  isAdmin: boolean;
  spotsCount?: number;
}

function nonEmptyString(x: unknown): string | null {
  return typeof x === "string" && x.length > 0 ? x : null;
}

function allowlisted(x: unknown, allowlist: readonly string[]): string | null {
  return typeof x === "string" && allowlist.includes(x) ? x : null;
}

/**
 * Public projection of a users/{uid} doc. Non-allowlisted (legacy) name styles become null;
 * spotsCount is included only when the user doc holds a non-negative integer.
 */
export function buildPublicProfile(
  user: Record<string, unknown>,
  {isAdmin}: {isAdmin: boolean},
): PublicProfile {
  const profile: PublicProfile = {
    username: typeof user.username === "string" ? user.username : null,
    profilePictureURL: nonEmptyString(user.profilePictureURL) ?? nonEmptyString(user.photoURL),
    customNameColor: allowlisted(user.customNameColor, NAME_COLORS),
    customNameFont: allowlisted(user.customNameFont, NAME_FONTS),
    isAdmin,
  };
  const count = user.spotsCount;
  if (typeof count === "number" && Number.isInteger(count) && count >= 0) {
    profile.spotsCount = count;
  }
  return profile;
}

/**
 * Shallow equality over the union of both objects' keys, ignoring `updatedAt`.
 * An absent key equals an undefined value.
 */
export function profileFieldsEqual(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  keys.delete("updatedAt");
  for (const key of keys) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}
