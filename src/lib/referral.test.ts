import { describe, expect, it } from 'vitest';
import { canStillClaim, inviteBadge, inviteLink, invitePathCode, nextInviteStep, normalizeInviteCode } from './referral';

describe('referral', () => {
  it('gives badges from 3 invitees', () => {
    expect(inviteBadge(0)).toBeNull();
    expect(inviteBadge(2)).toBeNull();
    expect(inviteBadge(3)).toBe('bronze');
    expect(inviteBadge(7)).toBe('silver');
    expect(inviteBadge(12)).toBe('gold');
  });
  it('names the next step', () => {
    expect(nextInviteStep(0)).toBe(1);
    expect(nextInviteStep(1)).toBe(3);
    expect(nextInviteStep(4)).toBe(5);
    expect(nextInviteStep(10)).toBeNull();
  });
  it('builds and reads invite links', () => {
    expect(inviteLink('https://x.hu/', 'anna_b')).toBe('https://x.hu/i/anna_b');
    expect(invitePathCode('/i/Anna_B')).toBe('anna_b');
    expect(invitePathCode('/i/anna_b/?utm=1')).toBe('anna_b');
    expect(invitePathCode('/spot/x')).toBeNull();
    expect(normalizeInviteCode('@anna_b')).toBe('anna_b');
    expect(normalizeInviteCode('https://x.hu/i/anna_b')).toBe('anna_b');
    expect(normalizeInviteCode('a')).toBeNull();
  });
  it('allows a claim in the first week only', () => {
    const now = Date.UTC(2026, 9, 11);
    expect(canStillClaim(now - 1000, now)).toBe(true);
    expect(canStillClaim(now - 8 * 86_400_000, now)).toBe(false);
    expect(canStillClaim(undefined, now)).toBe(false);
  });
});
