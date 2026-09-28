import { describe, expect, it } from 'vitest';
import { mapAdminDoc } from './mapAdminDoc';

describe('mapAdminDoc', () => {
  it('maps the stored `username` to the display name (addAdmin / bootstrap shape)', () => {
    const addedAt = { seconds: 1, nanoseconds: 0 };
    expect(mapAdminDoc('a1', {
      email: 'admin@spoton.test',
      username: 'e2e_admin',
      photoURL: 'https://doc/photo.png',
      addedAt,
      addedBy: 'super',
      role: 'admin',
    })).toEqual({
      id: 'a1',
      email: 'admin@spoton.test',
      name: 'e2e_admin',
      photoURL: 'https://doc/photo.png',
      addedAt,
      addedBy: 'super',
      role: 'admin',
    });
  });

  it('keeps `role` so the super admin can be filtered out; legacy docs have none', () => {
    expect(mapAdminDoc('s', { email: 's@x', username: 's', role: 'super' }).role).toBe('super');
    expect('role' in mapAdminDoc('l', { email: 'l@x', username: 'l' })).toBe(false);
  });

  it('falls back to a legacy `name`, then to the email', () => {
    expect(mapAdminDoc('a', { email: 'a@x', name: 'Old Name' }).name).toBe('Old Name');
    expect(mapAdminDoc('a', { email: 'a@x', username: '', name: 'Old Name' }).name).toBe('Old Name');
    expect(mapAdminDoc('a', { email: 'a@x' }).name).toBe('a@x');
    expect(mapAdminDoc('a', { email: 'a@x', username: '   ' }).name).toBe('a@x');
  });

  it('non-string or missing fields never leak through', () => {
    expect(mapAdminDoc('a', { username: 42, email: null, photoURL: 1, addedBy: {} })).toEqual({
      id: 'a',
      email: '',
      name: '',
      addedAt: undefined,
      addedBy: '',
    });
  });
});
