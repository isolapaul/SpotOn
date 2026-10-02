import { describe, expect, it } from 'vitest';
import { groupReports, parseReport } from './reports';

const r = (id: string, key: string, at: number) =>
  parseReport(id, { key, kind: 'review', spotId: 's', targetId: 'r1', reason: 'spam', createdAt: { toMillis: () => at } })!;

describe('reports', () => {
  it('parses and refuses malformed docs', () => {
    expect(r('a', 'k', 1)).toMatchObject({ kind: 'review', reason: 'spam', createdAt: 1 });
    expect(parseReport('x', { key: 'k', kind: 'nope', targetId: 't' })).toBeNull();
  });
  it('groups by thing, most reported first', () => {
    const g = groupReports([r('a', 'k1', 1), r('b', 'k2', 5), r('c', 'k1', 3)]);
    expect(g.map((x) => [x.key, x.reports.map((y) => y.id)])).toEqual([['k1', ['c', 'a']], ['k2', ['b']]]);
  });
});
