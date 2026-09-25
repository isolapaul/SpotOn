import { describe, expect, it } from 'vitest';
import { mapUserDoc } from './mapUserDoc';

const noAuth = { email: null, photoURL: null };

describe('mapUserDoc', () => {
  it('maps a full current-shape doc, preserving BUG-02 fields', () => {
    const user = mapUserDoc(
      'u1',
      { email: 'a@b.test', photoURL: 'https://auth/photo.png' },
      {
        uid: 'u1',
        username: 'alice',
        email: 'stale@b.test',
        photoURL: 'https://doc/photo.png',
        profilePictureURL: 'https://doc/pp.png',
        profileBannerURL: 'https://doc/banner.png',
        savedSpots: ['s1', 's2'],
        highlightedSpots: ['s3'],
        customNameColor: 'gold',
        customNameFont: 'serif',
        notificationSettings: { spotApproved: false, spotReviewed: true, newPendingSpot: false },
        spotsCount: 7,
      },
    );
    expect(user).toEqual({
      uid: 'u1',
      username: 'alice',
      email: 'a@b.test',
      photoURL: 'https://auth/photo.png',
      profilePictureURL: 'https://doc/pp.png',
      profileBannerURL: 'https://doc/banner.png',
      savedSpots: ['s1', 's2'],
      highlightedSpots: ['s3'],
      customNameColor: 'gold',
      customNameFont: 'serif',
      notificationSettings: { spotApproved: false, spotReviewed: true, newPendingSpot: false },
      spotsCount: 7,
    });
  });

  it('maps an empty doc with defaults and omits optional fields', () => {
    const user = mapUserDoc('u2', noAuth, {});
    expect(user).toEqual({
      uid: 'u2',
      username: 'user',
      email: '',
      photoURL: '',
      profilePictureURL: '',
      profileBannerURL: '',
      savedSpots: [],
      highlightedSpots: [],
    });
    expect('customNameColor' in user).toBe(false);
    expect('customNameFont' in user).toBe(false);
    expect('notificationSettings' in user).toBe(false);
    expect('spotsCount' in user).toBe(false);
  });

  it('maps a legacy doc with photoURL only and no username', () => {
    const user = mapUserDoc('u3', { email: 'l@b.test', photoURL: null }, { photoURL: 'https://doc/legacy.png' });
    expect(user.username).toBe('user');
    expect(user.photoURL).toBe('https://doc/legacy.png');
    expect(user.profilePictureURL).toBe('https://doc/legacy.png');
    expect(user.savedSpots).toEqual([]);
  });

  it('falls back to the auth photo for profilePictureURL', () => {
    const user = mapUserDoc('u4', { email: null, photoURL: 'https://auth/p.png' }, {});
    expect(user.photoURL).toBe('https://auth/p.png');
    expect(user.profilePictureURL).toBe('https://auth/p.png');
  });

  it('prefers the auth email over the doc email', () => {
    expect(mapUserDoc('u5', { email: 'auth@b.test', photoURL: null }, { email: 'doc@b.test' }).email).toBe('auth@b.test');
    expect(mapUserDoc('u5', noAuth, { email: 'doc@b.test' }).email).toBe('');
  });

  it('keeps only the three notification keys, defaulting missing or non-boolean ones to true', () => {
    const user = mapUserDoc('u6', noAuth, {
      notificationSettings: { spotApproved: false, spotReviewed: 'no', extra: true },
    });
    expect(user.notificationSettings).toEqual({ spotApproved: false, spotReviewed: true, newPendingSpot: true });
  });

  it.each([null, 'on', true, 5, ['spotApproved']])('omits notificationSettings for non-object %j', (value) => {
    expect('notificationSettings' in mapUserDoc('u7', noAuth, { notificationSettings: value })).toBe(false);
  });

  it('keeps only non-negative integer spotsCount', () => {
    expect(mapUserDoc('u8', noAuth, { spotsCount: 0 }).spotsCount).toBe(0);
    expect(mapUserDoc('u8', noAuth, { spotsCount: 20 }).spotsCount).toBe(20);
    for (const bad of [-1, 1.5, '3', null, Number.NaN]) {
      expect('spotsCount' in mapUserDoc('u8', noAuth, { spotsCount: bad })).toBe(false);
    }
  });

  it('omits non-string name styles', () => {
    const user = mapUserDoc('u9', noAuth, { customNameColor: 5, customNameFont: null });
    expect('customNameColor' in user).toBe(false);
    expect('customNameFont' in user).toBe(false);
  });
});
