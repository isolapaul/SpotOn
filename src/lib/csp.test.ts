import { describe, expect, it } from 'vitest';
import { buildCsp } from './csp.mjs';

// T15's three static policies, verbatim. nonce: null must reproduce them.
const T15_PROD =
  "default-src 'self'; script-src 'self' 'unsafe-inline' https://apis.google.com https://www.gstatic.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.tile.openstreetmap.org https://*.basemaps.cartocdn.com https://server.arcgisonline.com https://firebasestorage.googleapis.com https://*.googleusercontent.com; font-src 'self' data:; connect-src 'self' https://*.googleapis.com https://*.cloudfunctions.net https://apis.google.com; frame-src 'self' https://*.firebaseapp.com https://apis.google.com https://accounts.google.com; worker-src 'self' blob:; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests";
const T15_DEV =
  "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://www.gstatic.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.tile.openstreetmap.org https://*.basemaps.cartocdn.com https://server.arcgisonline.com https://firebasestorage.googleapis.com https://*.googleusercontent.com; font-src 'self' data:; connect-src 'self' https://*.googleapis.com https://*.cloudfunctions.net https://apis.google.com; frame-src 'self' https://*.firebaseapp.com https://apis.google.com https://accounts.google.com; worker-src 'self' blob:; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";
const T15_EMULATOR =
  "default-src 'self'; script-src 'self' 'unsafe-inline' https://apis.google.com https://www.gstatic.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.tile.openstreetmap.org https://*.basemaps.cartocdn.com https://server.arcgisonline.com https://firebasestorage.googleapis.com https://*.googleusercontent.com http://127.0.0.1:* http://localhost:*; font-src 'self' data:; connect-src 'self' https://*.googleapis.com https://*.cloudfunctions.net https://apis.google.com http://127.0.0.1:* http://localhost:* ws://127.0.0.1:* ws://localhost:*; frame-src 'self' https://*.firebaseapp.com https://apis.google.com https://accounts.google.com http://127.0.0.1:* http://localhost:*; worker-src 'self' blob:; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";

const NONCE = 'MTIzNDU2NzgtYWJjZC00ZWYwLTk4NzYtMDEyMzQ1Njc4OWFi';

const ENVS = [
  { name: 'production', isDev: false, useEmulators: false, t15: T15_PROD },
  { name: 'dev', isDev: true, useEmulators: false, t15: T15_DEV },
  { name: 'emulator', isDev: false, useEmulators: true, t15: T15_EMULATOR },
] as const;

/** Directive name → its full "name value…" segment. */
function directives(csp: string): Map<string, string> {
  return new Map(csp.split('; ').map((part) => [part.split(' ')[0], part]));
}

describe('buildCsp', () => {
  it.each(ENVS)('nonce null reproduces the T15 $name policy byte for byte', ({ isDev, useEmulators, t15 }) => {
    expect(buildCsp({ nonce: null, isDev, useEmulators })).toBe(t15);
  });

  it.each(ENVS)('$name with a nonce: strict-dynamic script-src, no unsafe-inline', ({ isDev, useEmulators }) => {
    const csp = buildCsp({ nonce: NONCE, isDev, useEmulators });
    const d = directives(csp);
    const scriptSrc = d.get('script-src');

    expect(csp.split(NONCE)).toHaveLength(2); // the nonce appears exactly once …
    expect(scriptSrc).toContain(`'nonce-${NONCE}'`); // … and it is in script-src
    expect(scriptSrc).toBe(
      `script-src 'self' 'nonce-${NONCE}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''} https://apis.google.com https://www.gstatic.com`,
    );
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(csp.includes("'unsafe-eval'")).toBe(isDev);
    expect(d.get('style-src')).toBe("style-src 'self' 'unsafe-inline'");
  });

  it.each(ENVS)('$name with a nonce: every other directive is unchanged from T15', ({ isDev, useEmulators, t15 }) => {
    const withNonce = directives(buildCsp({ nonce: NONCE, isDev, useEmulators }));
    const staticPolicy = directives(t15);
    expect([...withNonce.keys()]).toEqual([...staticPolicy.keys()]);
    for (const [name, value] of staticPolicy) {
      if (name !== 'script-src') expect(withNonce.get(name)).toBe(value);
    }
  });
});
