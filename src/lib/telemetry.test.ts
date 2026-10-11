import { describe, expect, it } from 'vitest';
import { errorReportOf, summarizeStats, TELEMETRY_EVENTS } from './telemetry';
import { EVENT_NAMES } from '../../functions/src/lib/telemetry';

describe('telemetry', () => {
  it('keeps the event list in sync with the server', () => {
    expect([...TELEMETRY_EVENTS]).toEqual([...EVENT_NAMES]);
  });
  it('turns thrown things into short reports and drops noise', () => {
    expect(errorReportOf(new TypeError('x is undefined'))).toMatchObject({ message: 'TypeError: x is undefined' });
    expect(errorReportOf('boom')).toEqual({ message: 'boom', stack: '' });
    expect(errorReportOf({ message: 'obj' })?.message).toBe('obj');
    expect(errorReportOf(new Error('Failed to fetch'))).toBeNull();
    expect(errorReportOf('Script error.')).toBeNull();
    expect(errorReportOf(undefined)).toBeNull();
  });
  it('sums the days over platforms, newest first', () => {
    const days = summarizeStats([
      { id: '2026-10-10', data: { app_open: { web: 2, ios: 1 }, sign_up: { android: 1 }, bogus: { web: 9 } } },
      { id: '2026-10-11', data: { visit: { web: 'x' } } },
    ]);
    expect(days.map((d) => d.day)).toEqual(['2026-10-11', '2026-10-10']);
    expect(days[1]).toEqual({ day: '2026-10-10', totals: { app_open: 3, sign_up: 1 }, byPlatform: { web: 2, ios: 1, android: 0 } });
    expect(days[0].totals).toEqual({});
  });
});
