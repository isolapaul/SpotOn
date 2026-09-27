import { describe, expect, it } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import type { Spot } from '@/store/useSpotStore';
import { mergeSpotSources } from './mergeSpots';

function spot(id: string, createdAt: unknown, extra: Partial<Spot> = {}): Spot {
  return {
    id, name: id, category: 'other', description: '', imageUrls: [], location: { lat: 0, lng: 0 },
    createdBy: 'u', status: 'approved', createdAt, ...extra,
  } as Spot;
}
const ts = (seconds: number, nanoseconds = 0) => new Timestamp(seconds, nanoseconds);
const ids = (spots: Spot[]) => spots.map((s) => s.id);
const NONE: Spot[] = [];

describe('mergeSpotSources', () => {
  it('returns [] for empty sources', () => {
    expect(mergeSpotSources({ admin: NONE, own: NONE, approved: NONE })).toEqual([]);
  });

  it('returns an admin-only list (already in Firestore order) unchanged', () => {
    const admin = [
      spot('p', null, { status: 'pending' }),
      spot('c', ts(300)),
      spot('b', ts(200, 5)),
      spot('z', ts(200, 1)),
      spot('a', ts(200, 1)),
      spot('y', ts(100)),
    ];
    const merged = mergeSpotSources({ admin, own: NONE, approved: NONE });
    expect(merged).toEqual(admin);
    expect(merged).not.toBe(admin);
  });

  it('unions by id with precedence admin > own > approved', () => {
    const approvedCopy = spot('x', ts(100), { name: 'approved copy' });
    const ownCopy = spot('x', ts(100), { name: 'own copy' });
    const adminCopy = spot('x', ts(100), { name: 'admin copy' });
    const other = spot('o', ts(50));

    expect(mergeSpotSources({ admin: NONE, own: [ownCopy], approved: [approvedCopy, other] }))
      .toEqual([ownCopy, other]);
    expect(mergeSpotSources({ admin: [adminCopy], own: [ownCopy], approved: [approvedCopy] }))
      .toEqual([adminCopy]);
    expect(mergeSpotSources({ admin: NONE, own: NONE, approved: [approvedCopy] })).toEqual([approvedCopy]);
  });

  it('sorts by createdAt desc (seconds, then nanoseconds) across sources', () => {
    const merged = mergeSpotSources({
      admin: NONE,
      own: [spot('own-old', ts(10)), spot('own-new', ts(500))],
      approved: [spot('a1', ts(300, 2)), spot('a2', ts(300, 9)), spot('a3', ts(20))],
    });
    expect(ids(merged)).toEqual(['own-new', 'a2', 'a1', 'a3', 'own-old']);
  });

  it('breaks createdAt ties by document id descending', () => {
    const merged = mergeSpotSources({
      admin: NONE,
      own: [spot('b', ts(100))],
      approved: [spot('a', ts(100)), spot('c', ts(100)), spot('B', ts(100))],
    });
    expect(ids(merged)).toEqual(['c', 'b', 'a', 'B']);
  });

  it('puts a null createdAt (pending server timestamp) first', () => {
    const merged = mergeSpotSources({
      admin: NONE,
      own: [spot('new-local', null, { status: 'pending' }), spot('mine', ts(10))],
      approved: [spot('newest', ts(999))],
    });
    expect(ids(merged)).toEqual(['new-local', 'newest', 'mine']);
  });

  it('puts non-Timestamp createdAt values after all Timestamps, ties by id desc', () => {
    const merged = mergeSpotSources({
      admin: NONE,
      own: NONE,
      approved: [
        spot('num', 1_700_000_000),
        spot('str', '2024-01-01'),
        spot('ts-old', ts(1)),
        spot('map', { seconds: 5, nanoseconds: 0 }), // a plain map, not a Timestamp
        spot('nul', null),
        spot('ts-new', ts(2)),
      ],
    });
    expect(ids(merged)).toEqual(['nul', 'ts-new', 'ts-old', 'str', 'num', 'map']);
  });
});
