// Pure in-memory rate limiting for the feedback endpoint (token bucket with an injected clock)
// and client IP extraction for the two deployment targets (Cloudflare Tunnel, Vercel).

export type TakeResult = { allowed: boolean; retryAfterSec: number };

export type TokenBucketOptions = {
  capacity?: number;
  refillIntervalMs?: number;
  maxKeys?: number;
  now?: () => number;
};

type BucketState = { tokens: number; updatedAt: number };

/**
 * Token bucket per key. One token is refilled every `refillIntervalMs`, continuously, up to
 * `capacity` (defaults: 5 requests per 10 minutes). At most `maxKeys` keys are kept: when a new
 * key would exceed that, keys whose buckets are full are dropped first, then the least recently
 * used ones, down to ~90% of `maxKeys` in one pass.
 */
export function createTokenBucket({
  capacity = 5,
  refillIntervalMs = 120_000,
  maxKeys = 10_000,
  now = Date.now,
}: TokenBucketOptions = {}) {
  // Map iteration order = insertion order; entries are re-inserted on every take (LRU order).
  const buckets = new Map<string, BucketState>();

  const refilled = (state: BucketState, t: number): number =>
    Math.min(capacity, state.tokens + Math.max(0, t - state.updatedAt) / refillIntervalMs);

  // Evict in one pass down to ~90% of maxKeys, so a flood of new keys does not scan every insert.
  const evictTarget = Math.max(0, Math.min(maxKeys - 1, Math.floor(maxKeys * 0.9)));
  const evict = (t: number) => {
    for (const [key, state] of buckets) {
      if (refilled(state, t) >= capacity) buckets.delete(key);
    }
    for (const key of buckets.keys()) {
      if (buckets.size <= evictTarget) break;
      buckets.delete(key);
    }
  };

  return {
    take(key: string): TakeResult {
      const t = now();
      const existing = buckets.get(key);
      if (!existing && buckets.size >= maxKeys) evict(t);
      const tokens = existing ? refilled(existing, t) : capacity;
      buckets.delete(key);
      if (tokens >= 1) {
        buckets.set(key, { tokens: tokens - 1, updatedAt: t });
        return { allowed: true, retryAfterSec: 0 };
      }
      buckets.set(key, { tokens, updatedAt: t });
      return { allowed: false, retryAfterSec: Math.max(1, Math.ceil(((1 - tokens) * refillIntervalMs) / 1000)) };
    },
    /** Number of keys currently tracked (for tests). */
    size: () => buckets.size,
  };
}

const MAX_KEY_CHARS = 64;

function parseIpv4(s: string): string | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s);
  if (!m) return null;
  const parts = m.slice(1).map(Number);
  if (parts.some((p) => p > 255)) return null;
  return parts.join('.');
}

/** Expands an IPv6 address into 8 numeric groups, or null if it is not one. */
function parseIpv6(s: string): number[] | null {
  let addr = s.toLowerCase();
  // Embedded IPv4 tail (e.g. ::ffff:203.0.113.5) → two hex groups.
  const lastColon = addr.lastIndexOf(':');
  if (lastColon !== -1 && addr.includes('.', lastColon)) {
    const v4 = parseIpv4(addr.slice(lastColon + 1));
    if (!v4) return null;
    const [a, b, c, d] = v4.split('.').map(Number);
    addr = `${addr.slice(0, lastColon + 1)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const halves = addr.split('::');
  if (halves.length > 2) return null;
  const toGroups = (part: string) => (part === '' ? [] : part.split(':'));
  const head = toGroups(halves[0]);
  const tail = halves.length === 2 ? toGroups(halves[1]) : [];
  let groups: string[];
  if (halves.length === 2) {
    const missing = 8 - head.length - tail.length;
    if (missing < 1) return null;
    groups = [...head, ...Array<string>(missing).fill('0'), ...tail];
  } else {
    groups = head;
  }
  if (groups.length !== 8 || !groups.every((g) => /^[0-9a-f]{1,4}$/.test(g))) return null;
  return groups.map((g) => parseInt(g, 16));
}

/**
 * Rate-limit key for an IP: IPv4 and IPv4-mapped IPv6 → dotted IPv4; other IPv6 → its /64
 * (a client usually controls a whole /64); anything unparseable → the raw value. Max 64 chars.
 */
export function normalizeIpKey(raw: string): string {
  const ip = raw.trim();
  const v4 = parseIpv4(ip);
  if (v4) return v4;
  const v6 = parseIpv6(ip);
  if (v6) {
    if (v6.slice(0, 5).every((g) => g === 0) && v6[5] === 0xffff) {
      return [v6[6] >> 8, v6[6] & 0xff, v6[7] >> 8, v6[7] & 0xff].join('.');
    }
    return `${v6.slice(0, 4).map((g) => g.toString(16)).join(':')}::/64`;
  }
  return ip.slice(0, MAX_KEY_CHARS);
}

/**
 * Client IP bucket key. On Vercel (`VERCEL=1`) only x-real-ip / the first x-forwarded-for hop are
 * trusted (a client can pass its own cf-connecting-ip through Vercel). Everywhere else the app is
 * reachable only via the Cloudflare Tunnel, so only cf-connecting-ip is trusted and
 * x-forwarded-for (client-controlled there) is never read.
 */
export function getClientIp(h: Headers, env: { VERCEL?: string; [name: string]: string | undefined }): string {
  let ip = '';
  if (env.VERCEL === '1') {
    ip = (h.get('x-real-ip') ?? '').trim();
    if (!ip) ip = (h.get('x-forwarded-for') ?? '').split(',')[0].trim();
  } else {
    ip = (h.get('cf-connecting-ip') ?? '').trim();
  }
  if (!ip) return 'unknown';
  return normalizeIpKey(ip).slice(0, MAX_KEY_CHARS);
}
