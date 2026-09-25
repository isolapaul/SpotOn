// Server-only: verifies Firebase Auth ID tokens (RS256, Google securetoken JWKS).
// Auth-emulator tokens are unsigned and are rejected on purpose — there is no emulator bypass.
import { createRemoteJWKSet, errors, jwtVerify, type JWTVerifyGetKey } from 'jose';

const JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'),
);

export type VerifiedIdToken = { uid: string; name?: string; email?: string; emailVerified: boolean };

/** The key set could not be fetched (network error, timeout, non-200 or malformed JWKS). */
export class KeySetUnavailableError extends Error {
  constructor(options?: { cause?: unknown }) {
    super('ID token key set unavailable', options);
    this.name = 'KeySetUnavailableError';
  }
}

const KEY_SET_FAILURE_CODES = new Set(['ERR_JOSE_GENERIC', 'ERR_JWKS_TIMEOUT', 'ERR_JWKS_INVALID']);

/**
 * Verifies a Firebase ID token and maps its claims. Throws on any failure: a
 * `KeySetUnavailableError` when the key set could not be loaded, a jose error otherwise.
 */
export async function verifyIdToken(
  token: string,
  { projectId, keySet = JWKS }: { projectId: string; keySet?: JWTVerifyGetKey },
): Promise<VerifiedIdToken> {
  let payload;
  try {
    ({ payload } = await jwtVerify(token, keySet, {
      issuer: 'https://securetoken.google.com/' + projectId,
      audience: projectId,
      algorithms: ['RS256'],
    }));
  } catch (err) {
    if (!(err instanceof errors.JOSEError) || KEY_SET_FAILURE_CODES.has(err.code)) {
      throw new KeySetUnavailableError({ cause: err });
    }
    throw err;
  }

  if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
    throw new errors.JWTClaimValidationFailed('"sub" claim must be a non-empty string', payload, 'sub', 'check_failed');
  }

  return {
    uid: payload.sub,
    name: typeof payload.name === 'string' ? payload.name : undefined,
    email: typeof payload.email === 'string' ? payload.email : undefined,
    emailVerified: payload.email_verified === true,
  };
}
