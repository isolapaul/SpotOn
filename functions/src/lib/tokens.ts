/**
 * Pure FCM helpers (no firebase imports): the stored registrations of a user, and the send-result
 * classifier. A registration (an FID, or a legacy token) is pruned only when FCM says it is dead
 * (installation-id-not-registered for FIDs, the token codes for tokens).
 */
export const PRUNABLE_TOKEN_ERROR_CODES: ReadonlySet<string> = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
  "messaging/installation-id-not-registered",
]);

export function isPrunableTokenError(code: string | undefined): boolean {
  return code !== undefined && PRUNABLE_TOKEN_ERROR_CODES.has(code);
}

export function selectTokensToPrune(
  tokens: string[],
  responses: ReadonlyArray<{success: boolean; error?: {code?: string}}>,
): string[] {
  const prune: string[] = [];
  responses.forEach((resp, i) => {
    if (resp.success === false && i < tokens.length && isPrunableTokenError(resp.error?.code)) {
      prune.push(tokens[i]);
    }
  });
  return prune;
}

/** The non-empty strings of a stored registration list (users.fcmFids, users.fcmTokens). */
export function registrationList(stored: unknown): string[] {
  return Array.isArray(stored) ?
    stored.filter((x: unknown): x is string => typeof x === "string" && x.length > 0) : [];
}
