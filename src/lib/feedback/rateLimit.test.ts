import { describe, expect, it } from 'vitest';
import { createTokenBucket, getClientIp, normalizeIpKey } from './rateLimit';

function fakeClock(start = 1_000_000) {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

describe('createTokenBucket', () => {
  it('allows 5, denies the 6th with retryAfterSec ≈ 120, and refills continuously', () => {
    const clock = fakeClock();
    const bucket = createTokenBucket({ capacity: 5, refillIntervalMs: 120_000, now: clock.now });
    for (let i = 0; i < 5; i++) expect(bucket.take('a').allowed).toBe(true);
    const denied = bucket.take('a');
    expect(denied.allowed).toBe(false);
    expect(denied.retryAfterSec).toBe(120);

    clock.advance(60_000);
    expect(bucket.take('a')).toEqual({ allowed: false, retryAfterSec: 60 });
    clock.advance(60_000);
    expect(bucket.take('a').allowed).toBe(true);
    expect(bucket.take('a').allowed).toBe(false);
  });

  it('keeps keys independent', () => {
    const clock = fakeClock();
    const bucket = createTokenBucket({ now: clock.now });
    for (let i = 0; i < 5; i++) bucket.take('a');
    expect(bucket.take('a').allowed).toBe(false);
    expect(bucket.take('b').allowed).toBe(true);
  });

  it('caps global traffic: 20 requests from 20 IPs pass, the 21st waits ≈ 180 s', () => {
    const clock = fakeClock();
    const perIp = createTokenBucket({ now: clock.now });
    const global = createTokenBucket({ capacity: 20, refillIntervalMs: 180_000, now: clock.now });
    for (let i = 1; i <= 20; i++) {
      expect(perIp.take(`203.0.113.${i}`).allowed).toBe(true);
      expect(global.take('global').allowed).toBe(true);
    }
    expect(perIp.take('203.0.113.21').allowed).toBe(true);
    const denied = global.take('global');
    expect(denied.allowed).toBe(false);
    expect(denied.retryAfterSec).toBe(180);
  });

  it('evicts the oldest key when maxKeys is exceeded', () => {
    const clock = fakeClock();
    const bucket = createTokenBucket({ capacity: 1, refillIntervalMs: 120_000, maxKeys: 2, now: clock.now });
    expect(bucket.take('a').allowed).toBe(true);
    expect(bucket.take('a').allowed).toBe(false);
    expect(bucket.take('b').allowed).toBe(true);
    expect(bucket.size()).toBe(2);
    expect(bucket.take('c').allowed).toBe(true); // evicts 'a' (least recently used, not full)
    expect(bucket.size()).toBe(2);
    expect(bucket.take('a').allowed).toBe(true); // fresh bucket again
  });

  it('evicts down to ~90% of maxKeys in one pass', () => {
    const clock = fakeClock();
    const bucket = createTokenBucket({ capacity: 1, refillIntervalMs: 120_000, maxKeys: 100, now: clock.now });
    for (let i = 0; i < 100; i++) bucket.take(`k${i}`);
    expect(bucket.size()).toBe(100);
    bucket.take('new'); // evicts k0..k9 (oldest), keeps k10..k99, adds 'new'
    expect(bucket.size()).toBe(91);
    expect(bucket.take('k10').allowed).toBe(false); // kept its (empty) state
    expect(bucket.size()).toBe(91);
    expect(bucket.take('k0').allowed).toBe(true); // evicted → fresh bucket
    expect(bucket.size()).toBe(92);
  });

  it('drops full buckets before the oldest one', () => {
    const clock = fakeClock();
    const bucket = createTokenBucket({ capacity: 2, refillIntervalMs: 120_000, maxKeys: 2, now: clock.now });
    bucket.take('a');
    bucket.take('a'); // a: 0 tokens (oldest)
    clock.advance(100_000);
    bucket.take('b'); // b: 1 token
    clock.advance(120_000); // a ≈ 1.83 tokens (not full), b = 2 (full)
    expect(bucket.take('c').allowed).toBe(true); // drops full 'b', keeps 'a'
    expect(bucket.size()).toBe(2);
    expect(bucket.take('a').allowed).toBe(true);
    expect(bucket.take('a').allowed).toBe(false); // 'a' kept its state
  });
});

describe('getClientIp', () => {
  const h = (init: Record<string, string>) => new Headers(init);

  it('non-Vercel: uses only cf-connecting-ip, never x-forwarded-for', () => {
    expect(getClientIp(h({ 'cf-connecting-ip': ' 198.51.100.7 ' }), {})).toBe('198.51.100.7');
    expect(
      getClientIp(h({ 'cf-connecting-ip': '198.51.100.7', 'x-forwarded-for': '1.1.1.1' }), {}),
    ).toBe('198.51.100.7');
    expect(getClientIp(h({ 'x-forwarded-for': '1.1.1.1, 2.2.2.2' }), {})).toBe('unknown');
    expect(getClientIp(h({ 'x-real-ip': '1.1.1.1' }), {})).toBe('unknown');
    expect(getClientIp(h({}), {})).toBe('unknown');
  });

  it('Vercel: x-real-ip wins, cf-connecting-ip is ignored, falls back to the first XFF hop', () => {
    const env = { VERCEL: '1' };
    expect(
      getClientIp(
        h({ 'x-real-ip': '9.9.9.9', 'cf-connecting-ip': '6.6.6.6', 'x-forwarded-for': '1.1.1.1' }),
        env,
      ),
    ).toBe('9.9.9.9');
    expect(getClientIp(h({ 'cf-connecting-ip': '6.6.6.6' }), env)).toBe('unknown');
    expect(getClientIp(h({ 'x-forwarded-for': '1.1.1.1, 2.2.2.2' }), env)).toBe('1.1.1.1');
    expect(getClientIp(h({ 'x-real-ip': '  ', 'x-forwarded-for': ' 1.1.1.1 ,2.2.2.2' }), env)).toBe('1.1.1.1');
  });

  it('keys IPv6 by /64 so a whole /64 shares one bucket', () => {
    const a = getClientIp(h({ 'cf-connecting-ip': '2001:db8:0:1:aaaa::1' }), {});
    const b = getClientIp(h({ 'cf-connecting-ip': '2001:db8:0:1::2' }), {});
    const c = getClientIp(h({ 'cf-connecting-ip': '2001:db8:0:2::1' }), {});
    expect(a).toBe('2001:db8:0:1::/64');
    expect(b).toBe(a);
    expect(c).toBe('2001:db8:0:2::/64');

    const bucket = createTokenBucket({ now: fakeClock().now });
    for (let i = 0; i < 3; i++) expect(bucket.take(a).allowed).toBe(true);
    for (let i = 0; i < 2; i++) expect(bucket.take(b).allowed).toBe(true);
    expect(bucket.take(a).allowed).toBe(false);
    expect(bucket.take(c).allowed).toBe(true);
  });

  it('maps IPv4-mapped IPv6 to IPv4', () => {
    expect(getClientIp(h({ 'cf-connecting-ip': '::ffff:203.0.113.5' }), {})).toBe('203.0.113.5');
    expect(normalizeIpKey('::FFFF:cb00:7105')).toBe('203.0.113.5');
  });

  it('normalises IPv6 notation and keeps unparseable values raw, capped at 64 chars', () => {
    expect(normalizeIpKey('2001:0DB8:0000:0001:0000:0000:0000:0001')).toBe('2001:db8:0:1::/64');
    expect(normalizeIpKey('::1')).toBe('0:0:0:0::/64');
    expect(normalizeIpKey('not-an-ip')).toBe('not-an-ip');
    expect(normalizeIpKey('1:2:3:4:5:6:7:8:9')).toBe('1:2:3:4:5:6:7:8:9');
    expect(normalizeIpKey('300.1.1.1')).toBe('300.1.1.1');
    expect(getClientIp(h({ 'cf-connecting-ip': 'z'.repeat(200) }), {})).toBe('z'.repeat(64));
  });
});
