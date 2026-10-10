// Account deletion (A2) error → translation key. Pure.
import type { TranslationKey } from './translations';

const REFUSAL_KEYS: Readonly<Record<string, TranslationKey>> = {
  'is-admin': 'deleteAccountAdmin',
  'confirmation-mismatch': 'deleteAccountMismatch',
};

/** What the user types to confirm deletion: username, else e-mail, else "delete" (as the server checks). */
export function deletionConfirmWord(user: { username?: string | null; email?: string | null; usernameMissing?: true }): string {
  return (!user.usernameMissing && user.username) || user.email || 'delete';
}

/** The message key for a failed deleteAccount call (server `details.reason`, else generic). */
export function deleteAccountErrorKey(error: unknown): TranslationKey {
  const details = typeof error === 'object' && error !== null ? (error as { details?: unknown }).details : undefined;
  const reason = typeof details === 'object' && details !== null ? (details as { reason?: unknown }).reason : undefined;
  return typeof reason === 'string' && Object.hasOwn(REFUSAL_KEYS, reason) ? REFUSAL_KEYS[reason] : 'deleteAccountError';
}
