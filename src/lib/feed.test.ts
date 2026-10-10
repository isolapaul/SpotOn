import { describe, expect, it } from 'vitest';
import type { Spot } from '@/store/useSpotStore';
import { buildFeed, countUnseen, feedAge, feedPhotos, isFreshSpot, suggestedPeople } from './feed';

const spot = (id: string, createdBy: string, at: number, extra: Partial<Spot> = {}): Spot =>
  ({
    id,
    name: id,
    category: 'other',
    description: '',
    imageUrls: [],
    location: { lat: 0, lng: 0 },
    createdBy,
    createdByName: `${createdBy}-name`,
    status: 'approved',
    createdAt: at,
    ...extra,
  }) as Spot;

describe('buildFeed', () => {
  const spots = [
    spot('old-followed', 'anna', 1000),
    spot('new-followed', 'anna', 5000),
    spot('approved-later', 'bela', 100, { approvedAt: 6000 }),
    spot('other', 'cili', 4000),
    spot('mine', 'me', 9000),
    spot('pending', 'anna', 9000, { status: 'pending' }),
    spot('deleted', 'deleted-user', 9000),
    spot('blocked', 'dani', 9000),
  ];
  const feed = buildFeed(spots, { following: new Set(['anna', 'bela']), me: 'me', hidden: new Set(['dani']) });

  it('lists followed people and the own spots newest first by approval, then creation', () => {
    expect(feed.followed.map((s) => s.id)).toEqual(['mine', 'approved-later', 'new-followed', 'old-followed']);
  });
  it('suggests everyone else, never pending, deleted-user or blocked spots', () => {
    expect(feed.suggested.map((s) => s.id)).toEqual(['other']);
  });
  it('counts followed spots newer than the last visit, never the own', () => {
    expect(countUnseen(feed.followed, 4000, 'me')).toBe(2);
    expect(countUnseen(feed.followed, 7000, 'me')).toBe(0);
  });
  it('near me keeps spots within the radius', () => {
    const far = spot('far', 'cili', 4000, { location: { lat: 47.5, lng: 21 } });
    const near = buildFeed([...spots, far], { following: new Set(), me: null, hidden: new Set(), near: { lat: 0, lng: 0 } });
    expect([...near.followed, ...near.suggested].map((s) => s.id)).not.toContain('far');
    expect(near.suggested.map((s) => s.id)).toContain('other');
  });
});

describe('isFreshSpot', () => {
  it('is fresh for a day', () => {
    expect(isFreshSpot(spot('a', 'x', 1000), 1000 + 60_000)).toBe(true);
    expect(isFreshSpot(spot('a', 'x', 1000), 1000 + 25 * 3600_000)).toBe(false);
  });
});

describe('feedPhotos', () => {
  it('puts the primary photo first and marks likeable photos', () => {
    const s = spot('s', 'x', 0, {
      imageUrls: ['a', 'b'],
      primaryImageIndex: 1,
      spotImages: [
        { id: 'ia', url: 'a', likes: 3, likedBy: ['u'], addedAt: null as never },
        { id: 'ib', url: 'b', likes: 0, likedBy: [], addedAt: null as never },
      ],
    });
    expect(feedPhotos(s)).toEqual([
      { url: 'b', imageId: 'ib', likes: 0, likedBy: [] },
      { url: 'a', imageId: 'ia', likes: 3, likedBy: ['u'] },
    ]);
  });
  it('reads legacy imageUrls with the server ids and drops the placeholder', () => {
    expect(feedPhotos(spot('s', 'x', 0, { imageUrls: ['u1'] }))).toEqual([{ url: 'u1', imageId: 's_0', likes: 0, likedBy: [] }]);
    expect(feedPhotos(spot('s', 'x', 0, { imageUrls: ['/placeholder-spot.jpg'] }))).toEqual([]);
    // Only the legacy singular imageUrl: shown, not likeable.
    expect(feedPhotos(spot('s', 'x', 0, { imageUrls: undefined as never, imageUrl: 'old.jpg' } as Partial<Spot>)))
      .toEqual([{ url: 'old.jpg', imageId: null, likes: 0, likedBy: [] }]);
  });
});

describe('suggestedPeople', () => {
  it('ranks posters by spot count', () => {
    const people = suggestedPeople([spot('1', 'a', 0), spot('2', 'b', 0), spot('3', 'b', 0)], 5);
    expect(people.map((p) => [p.uid, p.count])).toEqual([['b', 2], ['a', 1]]);
  });
});

describe('feedAge', () => {
  const now = 100 * 86_400_000;
  it('counts minutes, hours, days and weeks, then gives up for a date', () => {
    expect(feedAge(now - 10_000, now)).toEqual({ unit: 'now', n: 0 });
    expect(feedAge(now - 5 * 60_000, now)).toEqual({ unit: 'min', n: 5 });
    expect(feedAge(now - 3 * 3600_000, now)).toEqual({ unit: 'h', n: 3 });
    expect(feedAge(now - 2 * 86_400_000, now)).toEqual({ unit: 'd', n: 2 });
    expect(feedAge(now - 15 * 86_400_000, now)).toEqual({ unit: 'w', n: 2 });
    expect(feedAge(now - 40 * 86_400_000, now)).toBeNull();
    expect(feedAge(null, now)).toBeNull();
  });
});
