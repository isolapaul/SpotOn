// Domain-move notice (T19). NEXT_PUBLIC_MOVED_TO is set only in the Vercel build; next.config.mjs always
// defines it ('' when unset), so every bundle holds a constant here, never a runtime process.env lookup.

export const MOVED_BANNER_DISMISS_KEY = 'spoton-moved-banner-dismissed';

/** The new base URL, or null when unset, malformed or not https. */
export function parseMovedTo(raw: string | undefined): URL | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

export function getMovedTo(): URL | null {
  return parseMovedTo(process.env.NEXT_PUBLIC_MOVED_TO);
}

/** Dismissal is permanent per device (ROADMAP Q10): only the exact value '1' counts, with no expiry. */
export function isBannerDismissed(stored: string | null): boolean {
  return stored === '1';
}

/**
 * The same page on the new domain, keeping path and query. A protocol-relative path such as '//evil.example'
 * would resolve to another host, so anything that leaves the base origin falls back to the base URL.
 */
export function movedTarget(base: URL, pathname: string, search: string): string {
  const target = new URL(pathname + search, base);
  return target.origin === base.origin ? target.href : base.href;
}
