/**
 * Pure FCM send-result classifier (no firebase imports).
 * A registration (FID) is pruned only when FCM says it is dead (installation-id-not-registered;
 * the token codes are kept for registrations FCM still reports that way).
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
