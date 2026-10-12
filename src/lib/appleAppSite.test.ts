import { describe, expect, it } from 'vitest';
import { buildAppleAppSite, parseTeamId } from './appleAppSite';

describe('apple-app-site-association', () => {
  it('reads a team id', () => {
    expect(parseTeamId(' abcde12345 ')).toBe('ABCDE12345');
    expect(parseTeamId('short')).toBeNull();
    expect(parseTeamId(undefined)).toBeNull();
  });
  it('lists the app with the spot, profile and feed links, or nothing', () => {
    expect(buildAppleAppSite('ABCDE12345').applinks.details).toEqual([{
      appIDs: ['ABCDE12345.hu.isolapaul.spoton'],
      components: [{ '/': '/spot/*' }, { '/': '/user/*' }, { '/': '/feed' }, { '/': '/i/*' }, { '/': '/list/*' }],
    }]);
    expect(buildAppleAppSite(null).applinks.details).toEqual([]);
  });
});
