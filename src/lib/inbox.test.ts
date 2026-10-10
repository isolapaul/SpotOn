import { describe, expect, it } from 'vitest';
import { INBOX_TEXT, isApproval, opensProfile, opensSpot, parseInboxItem } from './inbox';
import { translations } from './translations';

describe('parseInboxItem', () => {
  it('reads a decision with its reason and time', () => {
    const item = parseInboxItem('n1', {
      type: 'spot_rejected', spotId: 's1', spotName: 'Hill', reason: 'Blurry', read: false, createdAt: { toMillis: () => 5 },
    }, 99);
    expect(item).toEqual({ id: 'n1', type: 'spot_rejected', spotId: 's1', spotName: 'Hill', reason: 'Blurry', read: false, createdAt: 5 });
  });
  it('a pending server time reads as now; unknown types are skipped', () => {
    expect(parseInboxItem('n2', { type: 'photo_approved', createdAt: null }, 99)?.createdAt).toBe(99);
    expect(parseInboxItem('n3', { type: 'something_else' }, 99)).toBeNull();
  });
});

describe('INBOX_TEXT', () => {
  it('every type has its texts in all three languages', () => {
    for (const { title, body } of Object.values(INBOX_TEXT)) {
      for (const lang of ['hu', 'en', 'de'] as const) {
        expect(translations[lang][title]).toBeTruthy();
        expect(translations[lang][body]).toBeTruthy();
      }
    }
  });
  it('the positive look: the three approvals and follow news (item 8)', () => {
    expect(Object.keys(INBOX_TEXT).filter((type) => isApproval(type as never))).toEqual([
      'spot_approved', 'edit_approved', 'photo_approved', 'review_reply', 'follow_request', 'follow_accepted', 'followed_spot', 'new_follower',
    ]);
  });
});

describe('inbox taps', () => {
  it('follow news open the profile, spot notices the spot, removals nothing', () => {
    expect(opensProfile('new_follower')).toBe(true);
    expect(opensProfile('follow_request')).toBe(true);
    expect(opensProfile('followed_spot')).toBe(false);
    expect(opensSpot('followed_spot')).toBe(true);
    expect(opensSpot('spot_approved')).toBe(true);
    expect(opensSpot('spot_removed')).toBe(false);
    expect(opensSpot('new_follower')).toBe(false);
  });
});
