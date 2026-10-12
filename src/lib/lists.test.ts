import { describe, expect, it } from 'vitest';
import { listNameKey, parseList, publicListFromPath, publicListPath } from './lists';

describe('lists', () => {
  it('parses public lists (legacy ones are private)', () => {
    expect(parseList('l', { name: ' Sunsets ', spotIds: ['a'], shared: true, public: true })?.public).toBe(true);
    expect(parseList('l', { name: 'Old', spotIds: [] })?.public).toBe(false);
  });
  it('keys names for search', () => {
    expect(listNameKey('  Naplemente Helyek ')).toBe('naplemente helyek');
  });
  it('builds and reads public list addresses', () => {
    expect(publicListPath('u1', 'l1')).toBe('/list/u1/l1');
    expect(publicListFromPath('/list/u1/l1')).toEqual({ uid: 'u1', listId: 'l1' });
    expect(publicListFromPath('/list/u1/l1/')).toEqual({ uid: 'u1', listId: 'l1' });
    expect(publicListFromPath('/list/u1')).toBeNull();
    expect(publicListFromPath('/list/u%ZZ/l1')).toBeNull();
    expect(publicListFromPath('/list/u.1/l1')).toBeNull();
  });
});
