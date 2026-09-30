// Acceptance of the Terms of Use and the Privacy Policy (A1). Owner decision (2026-09-29): signing in
// or signing up is the acceptance (the sign-in sheet says so and links both documents); existing
// users accept once in a prompt. The users doc records the version and the time.

/** Bump when the Terms or the Privacy Policy change materially: everyone is asked once more. */
export const TERMS_VERSION = '2026-09-30';

/** Whether the signed-in user still has to accept the current version. */
export function needsTermsAcceptance(acceptedVersion: string | undefined): boolean {
  return acceptedVersion !== TERMS_VERSION;
}
