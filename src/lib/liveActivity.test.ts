import { describe, expect, it } from 'vitest';
import { activityChanges, activityStatusKey } from './liveActivity';

describe('activityChanges', () => {
  it('starts, updates on progress, ends with the result', () => {
    expect(activityChanges([{ id: 'a', kind: 'spot', status: 'running' }], new Map())).toEqual([
      { op: 'start', id: 'a', phase: 'uploading', progress: -1 },
    ]);
    expect(activityChanges([{ id: 'a', kind: 'spot', status: 'running', progress: 0.5 }], new Map([['a', -1]]))).toEqual([
      { op: 'update', id: 'a', phase: 'uploading', progress: 0.5 },
    ]);
    expect(activityChanges([{ id: 'a', kind: 'spot', status: 'running', progress: 0.5 }], new Map([['a', 0.5]]))).toEqual([]);
    expect(activityChanges([{ id: 'a', kind: 'spot', status: 'done', progress: 1 }], new Map([['a', 0.5]]))).toEqual([
      { op: 'end', id: 'a', phase: 'done', progress: 1 },
    ]);
    expect(activityChanges([{ id: 'a', kind: 'spot', status: 'failed', progress: 0.5 }], new Map([['a', 0.5]]))).toEqual([
      { op: 'end', id: 'a', phase: 'failed', progress: 0.5 },
    ]);
  });
  it('ends a job that disappeared, ignores finished ones it never showed', () => {
    expect(activityChanges([], new Map([['a', 0.2]]))).toEqual([{ op: 'end', id: 'a', phase: 'failed', progress: 0.2 }]);
    expect(activityChanges([{ id: 'b', kind: 'photos', status: 'done' }], new Map())).toEqual([]);
  });
  it('words the status per kind', () => {
    expect(activityStatusKey('spot', 'uploading')).toBe('activitySpotUploading');
    expect(activityStatusKey('photos', 'done')).toBe('activityPhotosDone');
    expect(activityStatusKey('review', 'failed')).toBe('activityFailed');
  });
});
