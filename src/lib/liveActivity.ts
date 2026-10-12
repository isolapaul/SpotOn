// Upload jobs → Live Activity changes (the Dynamic Island, store/nativeExtras). Pure.
import type { TranslationKey } from './translations';

export interface JobView {
  id: string;
  kind: 'spot' | 'photos' | 'review';
  status: 'running' | 'failed' | 'done';
  progress?: number;
}

export type ActivityChange =
  | { op: 'start' | 'update'; id: string; phase: 'uploading'; progress: number }
  | { op: 'end'; id: string; phase: 'done' | 'failed'; progress: number };

/**
 * What to tell the Live Activities, given the jobs now and the activity ids already running (with
 * their last progress). A job that disappeared while running ends as failed (cancelled).
 */
export function activityChanges(jobs: readonly JobView[], running: ReadonlyMap<string, number>): ActivityChange[] {
  const out: ActivityChange[] = [];
  const seen = new Set<string>();
  for (const job of jobs) {
    seen.add(job.id);
    const progress = job.progress ?? -1;
    const known = running.has(job.id);
    if (job.status === 'running') {
      if (!known) out.push({ op: 'start', id: job.id, phase: 'uploading', progress });
      else if (running.get(job.id) !== progress) out.push({ op: 'update', id: job.id, phase: 'uploading', progress });
    } else if (known) {
      out.push({ op: 'end', id: job.id, phase: job.status, progress: job.status === 'done' ? 1 : progress });
    }
  }
  for (const id of running.keys()) {
    if (!seen.has(id)) out.push({ op: 'end', id, phase: 'failed', progress: running.get(id) ?? -1 });
  }
  return out;
}

/** The status line of an upload activity. */
export function activityStatusKey(kind: JobView['kind'], phase: 'uploading' | 'done' | 'failed'): TranslationKey {
  if (phase === 'failed') return 'activityFailed';
  if (phase === 'done') return kind === 'spot' ? 'activitySpotDone' : kind === 'review' ? 'activityReviewDone' : 'activityPhotosDone';
  return kind === 'spot' ? 'activitySpotUploading' : kind === 'review' ? 'activityReviewUploading' : 'activityPhotosUploading';
}
