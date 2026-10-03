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
