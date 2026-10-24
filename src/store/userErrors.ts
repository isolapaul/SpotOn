import type { TranslationKey } from '@/lib/translations';

export function errorCode(error: unknown): unknown {
  return typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : undefined;
}

/**
 * Codes this store throws as Error.message, mapped to translation keys. Codes without an
 * entry (e.g. NOT_SUPER_ADMIN) fall back to the display site's generic key.
 */
const USER_ERROR_KEYS: Partial<Record<string, TranslationKey>> = {
  NOT_AUTHENTICATED: 'pleaseSignIn',
  USERNAME_TOO_SHORT: 'usernameTooShort',
  USERNAME_TOO_LONG: 'usernameTooLong',
  USERNAME_INVALID_CHARS: 'usernameInvalidChars',
  USERNAME_TAKEN: 'usernameTaken',
  ALREADY_ADMIN: 'userAlreadyAdmin',
};

/** Callable (HttpsError) codes with a meaning that does not depend on the callable. */
const CALLABLE_ERROR_KEYS: Partial<Record<string, TranslationKey>> = {
  'functions/unauthenticated': 'pleaseSignIn',
};

/** Translation key for an error thrown by this store, or undefined (use the site's generic key). */
export function userErrorKey(error: unknown): TranslationKey | undefined {
  const message = error instanceof Error ? error.message : undefined;
  if (message && Object.hasOwn(USER_ERROR_KEYS, message)) return USER_ERROR_KEYS[message];
  const code = errorCode(error);
  if (typeof code === 'string' && Object.hasOwn(CALLABLE_ERROR_KEYS, code)) return CALLABLE_ERROR_KEYS[code];
  return undefined;
}

/** The error code for an invalid username (see USER_ERROR_KEYS), or null when it is valid. */
export function usernameValidationError(name: string): string | null {
  if (name.length < 3) return 'USERNAME_TOO_SHORT';
  if (name.length > 20) return 'USERNAME_TOO_LONG';
  if (!/^[a-z0-9_]+$/.test(name)) return 'USERNAME_INVALID_CHARS';
  return null;
}
