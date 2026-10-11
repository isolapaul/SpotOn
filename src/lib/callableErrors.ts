// Error texts for callable failures. Pure.
import type { TranslationKey } from './translations';

/** A callable refused because the user hit a rate limit (replies, reports, follows, search). */
export function isRateLimited(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'functions/resource-exhausted';
}

/** The toast for a failed action: the rate-limit text, or the generic one. */
export function actionErrorKey(error: unknown): TranslationKey {
  return isRateLimited(error) ? 'rateLimited' : 'genericError';
}

/**
 * The reason code a callable threw (`HttpsError(code, "VISIT_TOO_FAR")`). The Firebase SDK
 * appends the HTTP status to the message ("VISIT_TOO_FAR [400]"), so an exact comparison fails.
 */
export function callableReason(error: unknown): string | null {
  const message = typeof error === 'object' && error !== null ? (error as { message?: unknown }).message : null;
  if (typeof message !== 'string') return null;
  const match = /^(?:Firebase:\s*)?([A-Z][A-Z0-9_]+)(?:\s*\[\d+\])?\s*$/.exec(message.trim());
  return match ? match[1] : null;
}
