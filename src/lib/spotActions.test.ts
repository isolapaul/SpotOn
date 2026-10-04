import { describe, expect, it } from 'vitest';
import { spotOverflowActions } from './spotActions';

describe('spotOverflowActions', () => {
  it('signed out: share on an approved spot only', () => {
    expect(spotOverflowActions({ signedIn: false, isOwner: false, approved: true })).toEqual(['share']);
    expect(spotOverflowActions({ signedIn: false, isOwner: false, approved: false })).toEqual([]);
  });

  it('signed in, not the owner: lists and share on an approved spot, nothing on a pending one', () => {
    expect(spotOverflowActions({ signedIn: true, isOwner: false, approved: true })).toEqual(['list', 'share']);
    expect(spotOverflowActions({ signedIn: true, isOwner: false, approved: false })).toEqual([]);
  });

  it('the owner also highlights, whatever the status', () => {
    expect(spotOverflowActions({ signedIn: true, isOwner: true, approved: true })).toEqual(['list', 'share', 'highlight']);
    expect(spotOverflowActions({ signedIn: true, isOwner: true, approved: false })).toEqual(['highlight']);
  });
});
