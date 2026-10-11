import { describe, expect, it } from 'vitest';
import { hasContributed, isSpotLocked, type LockContext } from './spotLock';

const ctx = (extra: Partial<LockContext> = {}): LockContext => ({
  enabled: true, uid: 'me', isAdmin: false, contributed: false,
  following: new Set(['friend']), popular: new Set(['top']), linked: new Set(['shared']), ...extra,
});
const spot = (id: string, createdBy = 'someone', status: 'approved' | 'pending' = 'approved') => ({ id, createdBy, status });

describe('spotLock', () => {
  it('locks other people\'s approved spots until the user contributes', () => {
    expect(isSpotLocked(spot('a'), ctx())).toBe(true);
    expect(isSpotLocked(spot('a'), ctx({ contributed: true }))).toBe(false);
    expect(isSpotLocked(spot('a'), ctx({ enabled: false }))).toBe(false);
    expect(isSpotLocked(spot('a'), ctx({ isAdmin: true }))).toBe(false);
  });
  it('keeps own, followed, popular, linked and non-approved spots open', () => {
    expect(isSpotLocked(spot('a', 'me'), ctx())).toBe(false);
    expect(isSpotLocked(spot('a', 'friend'), ctx())).toBe(false);
    expect(isSpotLocked(spot('top'), ctx())).toBe(false);
    expect(isSpotLocked(spot('shared'), ctx())).toBe(false);
    expect(isSpotLocked(spot('a', 'someone', 'pending'), ctx())).toBe(false);
  });
  it('signed out: only the popular and linked ones are open', () => {
    expect(isSpotLocked(spot('a'), ctx({ uid: null, following: new Set() }))).toBe(true);
    expect(isSpotLocked(spot('top'), ctx({ uid: null }))).toBe(false);
  });
  it('counts invites as a contribution outside the iOS app only', () => {
    expect(hasContributed({ ownSpots: 1, invites: 0, ios: true })).toBe(true);
    expect(hasContributed({ ownSpots: 0, invites: 1, ios: false })).toBe(true);
    expect(hasContributed({ ownSpots: 0, invites: 1, ios: true })).toBe(false);
    expect(hasContributed({ ownSpots: 0, invites: 0, ios: false })).toBe(false);
  });
});
