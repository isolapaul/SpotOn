// Shareable spot links (/spot/<id>). Pure.

/** The same id rule the server uses (functions/src/lib/ids.ts). */
export function isValidSpotIdClient(x: unknown): x is string {
  return typeof x === 'string' && x.length > 0 && x.length <= 200 && !x.includes('/') && x !== '.' && x !== '..' && !/^__.*__$/.test(x);
}

/** The public link of a spot. */
export function spotLink(origin: string, spotId: string): string {
  return `${origin.replace(/\/$/, '')}/spot/${encodeURIComponent(spotId)}`;
}

/** The spot id of a /spot/<id> path, else null. */
export function spotIdFromPath(pathname: string | null | undefined): string | null {
  const m = /^\/spot\/([^/]+)\/?$/.exec(pathname ?? '');
  if (!m) return null;
  const id = decodeURIComponent(m[1]);
  return isValidSpotIdClient(id) ? id : null;
}
