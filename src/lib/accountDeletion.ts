// Account deletion (A2) error → translation key. Pure.
import type { TranslationKey } from './translations';

const REFUSAL_KEYS: Readonly<Record<string, TranslationKey>> = {
  'is-admin': 'deleteAccountAdmin',
  'confirmation-mismatch': 'deleteAccountMismatch',
};

/** The message key for a failed deleteAccount call (server `details.reason`, else generic). */
export function deleteAccountErrorKey(error: unknown): TranslationKey {
  const details = typeof error === 'object' && error !== null ? (error as { details?: unknown }).details : undefined;
  const reason = typeof details === 'object' && details !== null ? (details as { reason?: unknown }).reason : undefined;
  return typeof reason === 'string' && Object.hasOwn(REFUSAL_KEYS, reason) ? REFUSAL_KEYS[reason] : 'deleteAccountError';
}
