import { describe, expect, it } from 'vitest';
import { foldText, matchesSpotQuery } from './search';

describe('spot search', () => {
  it('ignores accents and case', () => {
    expect(foldText('Tihanyi Apátság')).toBe('tihanyi apatsag');
    expect(matchesSpotQuery('Tihanyi Apátság', 'apats')).toBe(true);
    expect(matchesSpotQuery('Tihanyi Apátság', 'ÁPÁT')).toBe(true);
    expect(matchesSpotQuery('Balaton', 'tihany')).toBe(false);
    expect(matchesSpotQuery('Balaton', '  ')).toBe(false);
  });
});
