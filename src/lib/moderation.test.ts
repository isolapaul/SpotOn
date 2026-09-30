import { describe, expect, it } from 'vitest';
import type { Spot } from '@/store/useSpotStore';
import {
  MAX_REASON_LENGTH, editRoute, isEmptyProposal, mergeProposal, parsePhotoSubmission, parseSpotEdit, proposalDiff, validReason,
} from './moderation';

const spot = (over: Partial<Spot> = {}): Spot => ({
  id: 's1', name: 'Old', category: 'park', description: 'desc', location: { lat: 47, lng: 19 },
  imageUrls: ['a', 'b'], spotImages: [], primaryImageIndex: 0, createdBy: 'owner', status: 'approved',
  createdAt: null, ...over,
} as Spot);

describe('validReason', () => {
  it('trims, and needs 1-500 characters', () => {
    expect(validReason('  spam ')).toBe('spam');
    expect(validReason('   ')).toBeNull();
    expect(validReason('x'.repeat(MAX_REASON_LENGTH + 1))).toBeNull();
  });
});

describe('editRoute', () => {
  it('admins edit directly; owners directly while under review, else they propose; others not at all', () => {
    expect(editRoute(spot(), 'x', true)).toBe('direct');
    expect(editRoute(spot(), 'owner', false)).toBe('propose');
    expect(editRoute(spot({ status: 'pending' }), 'owner', false)).toBe('direct');
    expect(editRoute(spot({ status: 'rejected' }), 'owner', false)).toBe('direct');
    expect(editRoute(spot(), 'x', false)).toBeNull();
    expect(editRoute(spot(), undefined, false)).toBeNull();
  });
});

describe('mergeProposal', () => {
  it('keeps real changes and adds to a waiting proposal', () => {
    expect(mergeProposal(spot(), { name: 'New' }, { description: 'd2', removeImageUrls: ['a'] }))
      .toEqual({ name: 'New', description: 'd2', removeImageUrls: ['a'] });
  });
  it('drops values equal to the current spot and removals of unknown photos', () => {
    expect(mergeProposal(spot(), undefined, { name: 'Old', category: 'park', location: { lat: 47, lng: 19 }, removeImageUrls: ['zzz'] })).toEqual({});
  });
  it('drops a primary photo that already is primary, is removed, or is unknown', () => {
    expect(mergeProposal(spot(), undefined, { primaryImageUrl: 'a' })).toEqual({});
    expect(mergeProposal(spot(), undefined, { primaryImageUrl: 'b', removeImageUrls: ['b'] })).toEqual({ removeImageUrls: ['b'] });
    expect(mergeProposal(spot(), undefined, { primaryImageUrl: 'zzz' })).toEqual({});
    expect(mergeProposal(spot(), undefined, { primaryImageUrl: 'b' })).toEqual({ primaryImageUrl: 'b' });
  });
  it('an edit back to the current value empties the proposal', () => {
    const merged = mergeProposal(spot(), { name: 'New' }, { name: 'Old' });
    expect(isEmptyProposal(merged)).toBe(true);
  });
});

describe('proposalDiff', () => {
  it('lists what changes, in display order', () => {
    const rows = proposalDiff(spot(), {
      primaryImageUrl: 'b', removeImageUrls: ['a'], location: { lat: 48, lng: 19 }, category: 'hiking', description: 'd2', name: 'New',
    });
    expect(rows.map((r) => r.kind)).toEqual(['text', 'text', 'category', 'location', 'photosRemoved', 'primaryPhoto']);
    expect(rows[0]).toEqual({ kind: 'text', field: 'name', before: 'Old', after: 'New' });
  });
  it('shows nothing for values the spot already has', () => {
    expect(proposalDiff(spot(), { name: 'Old', category: 'park' })).toEqual([]);
  });
});

describe('parsers', () => {
  it('reads a waiting and a rejected proposal, and refuses others', () => {
    expect(parseSpotEdit('s1', { status: 'pending', proposed: { name: 'x' }, ownerId: 'o', spotName: 'S' }))
      .toEqual({ spotId: 's1', spotName: 'S', ownerId: 'o', status: 'pending', proposed: { name: 'x' }, createdAtMs: 0 });
    expect(parseSpotEdit('s1', { status: 'pending', proposed: {}, createdAt: { toMillis: () => 1234 } })?.createdAtMs)
      .toBe(1234);
    expect(parseSpotEdit('s1', { status: 'rejected', proposed: {}, rejection: { reason: 'no' } })?.reason).toBe('no');
    expect(parseSpotEdit('s1', { status: 'approved', proposed: {} })).toBeNull();
    expect(parseSpotEdit('s1', null)).toBeNull();
  });
  it('reads a photo submission', () => {
    expect(parsePhotoSubmission('p1', { spotId: 's1', url: 'u', uploader: 'b', spotName: 'S' }))
      .toEqual({ id: 'p1', spotId: 's1', url: 'u', uploader: 'b', spotName: 'S' });
    expect(parsePhotoSubmission('p1', { spotId: 's1' })).toBeNull();
  });
});
