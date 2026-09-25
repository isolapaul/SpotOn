import { beforeAll, describe, expect, it } from 'vitest';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWTVerifyGetKey } from 'jose';
import { KeySetUnavailableError, verifyIdToken } from './verifyIdToken';

const PROJECT = 'demo-spoton';
const ISS = `https://securetoken.google.com/${PROJECT}`;
const KID = 'test-key';

let privateKey: CryptoKey;
let keySet: JWTVerifyGetKey;

beforeAll(async () => {
  const pair = await generateKeyPair('RS256');
  privateKey = pair.privateKey;
  const jwk = await exportJWK(pair.publicKey);
  keySet = createLocalJWKSet({ keys: [{ ...jwk, kid: KID, alg: 'RS256', use: 'sig' }] });
});

type Claims = Record<string, unknown>;

async function sign(claims: Claims = {}, opts: { iss?: string; aud?: string; sub?: string; exp?: number } = {}) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ name: 'Ada', email: 'ada@example.test', email_verified: true, ...claims })
    .setProtectedHeader({ alg: 'RS256', kid: KID })
    .setIssuer(opts.iss ?? ISS)
    .setAudience(opts.aud ?? PROJECT)
    .setSubject(opts.sub ?? 'uid-123')
    .setIssuedAt(now - 60)
    .setExpirationTime(opts.exp ?? now + 3600)
    .sign(privateKey);
}

const b64url = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');

describe('verifyIdToken', () => {
  it('accepts a valid token and maps its claims', async () => {
    await expect(verifyIdToken(await sign(), { projectId: PROJECT, keySet })).resolves.toEqual({
      uid: 'uid-123',
      name: 'Ada',
      email: 'ada@example.test',
      emailVerified: true,
    });
  });

  it('maps absent name and unverified email', async () => {
    const token = await sign({ name: undefined, email_verified: false });
    await expect(verifyIdToken(token, { projectId: PROJECT, keySet })).resolves.toEqual({
      uid: 'uid-123',
      name: undefined,
      email: 'ada@example.test',
      emailVerified: false,
    });
    const token2 = await sign({ email_verified: 'true' });
    expect((await verifyIdToken(token2, { projectId: PROJECT, keySet })).emailVerified).toBe(false);
  });

  it('rejects a wrong audience', async () => {
    await expect(verifyIdToken(await sign({}, { aud: 'other-project' }), { projectId: PROJECT, keySet })).rejects.toThrow();
  });

  it('rejects a wrong issuer', async () => {
    const token = await sign({}, { iss: 'https://securetoken.google.com/other-project' });
    await expect(verifyIdToken(token, { projectId: PROJECT, keySet })).rejects.toThrow();
  });

  it('rejects an expired token', async () => {
    const token = await sign({}, { exp: Math.floor(Date.now() / 1000) - 3600 });
    await expect(verifyIdToken(token, { projectId: PROJECT, keySet })).rejects.toThrow();
  });

  it('rejects alg none (unsigned, like Auth-emulator tokens)', async () => {
    const now = Math.floor(Date.now() / 1000);
    const payload = { iss: ISS, aud: PROJECT, sub: 'uid-123', iat: now, exp: now + 3600 };
    const token = `${b64url({ alg: 'none', typ: 'JWT' })}.${b64url(payload)}.`;
    await expect(verifyIdToken(token, { projectId: PROJECT, keySet })).rejects.toThrow();
  });

  it('rejects an HS256 token', async () => {
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256', kid: KID })
      .setIssuer(ISS)
      .setAudience(PROJECT)
      .setSubject('uid-123')
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode('a-shared-secret-of-sufficient-length!'));
    await expect(verifyIdToken(token, { projectId: PROJECT, keySet })).rejects.toThrow();
  });

  it('rejects an empty sub', async () => {
    const token = await sign({}, { sub: '' });
    await expect(verifyIdToken(token, { projectId: PROJECT, keySet })).rejects.toThrow(/sub/);
  });

  it('rejects a token signed by another key', async () => {
    const other = await generateKeyPair('RS256');
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256', kid: KID })
      .setIssuer(ISS)
      .setAudience(PROJECT)
      .setSubject('uid-123')
      .setExpirationTime('1h')
      .sign(other.privateKey);
    await expect(verifyIdToken(token, { projectId: PROJECT, keySet })).rejects.toThrow();
  });

  it('reports key-set failures as KeySetUnavailableError, token failures not', async () => {
    const failing: JWTVerifyGetKey = async () => {
      throw new TypeError('fetch failed');
    };
    await expect(verifyIdToken(await sign(), { projectId: PROJECT, keySet: failing })).rejects.toBeInstanceOf(
      KeySetUnavailableError,
    );
    await expect(verifyIdToken('abc.def.ghi', { projectId: PROJECT, keySet })).rejects.not.toBeInstanceOf(
      KeySetUnavailableError,
    );
  });
});
