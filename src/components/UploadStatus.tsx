'use client';

import { Check, CircleAlert, Loader2, RotateCw, X } from 'lucide-react';
import { useUploadStore, type UploadJob } from '@/store/useUploadStore';
import { useT } from '@/hooks/useT';
import { Z } from '@/lib/constants';

/** The job the pill shows: a failure first (it needs the user), then running, then just done. */
function pick(jobs: UploadJob[]): UploadJob | undefined {
  return jobs.find((j) => j.status === 'failed') ?? jobs.find((j) => j.status === 'running') ?? jobs.find((j) => j.status === 'done');
}

/** Background upload status (G4): a small pill under the top buttons, with Retry on failure. */
export default function UploadStatus() {
  const jobs = useUploadStore((s) => s.jobs);
  const retry = useUploadStore((s) => s.retry);
  const dismiss = useUploadStore((s) => s.dismiss);
  const t = useT();
  const job = pick(jobs);
  if (!job) return null;

  const running = jobs.filter((j) => j.status === 'running').length;
  let icon = <Loader2 className="w-4 h-4 text-sky-400 animate-spin" strokeWidth={2.5} />;
  let label = running > 1 ? t('uploadRunningMany', { count: running }) : t('uploadRunning', { name: job.label });
  if (job.status === 'failed') {
    icon = <CircleAlert className="w-4 h-4 text-red-400" strokeWidth={2.5} />;
    label = t(job.errorKey ?? 'spotUploadFailed');
  } else if (job.status === 'done') {
    icon = <Check className="w-4 h-4 text-emerald-400" strokeWidth={3} />;
    label = t('uploadDone');
  }

  return (
    <div
      className={`fixed ${Z.floatingButton} left-1/2 -translate-x-1/2 w-max max-w-[calc(100%-2rem)]`}
      style={{ top: 'calc(4.5rem + env(safe-area-inset-top))' }}
      role="status"
      aria-live="polite"
    >
      <div
        key={`${job.id}-${job.status}`}
        className="flex items-center gap-2.5 pl-3.5 pr-2 py-2 rounded-full bg-slate-900 ring-1 ring-white/10 shadow-2xl motion-safe:animate-prompt-in"
      >
        <span className="flex-shrink-0">{icon}</span>
        <span className={`text-sm text-white/90 ${job.status === 'failed' ? 'line-clamp-2' : 'truncate'}`}>{label}</span>
        {job.status === 'failed' ? (
          <>
            <button
              onClick={() => retry(job.id)}
              className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full bg-sky-500 text-white text-sm font-semibold active:scale-95 transition touch-manipulation"
            >
              <RotateCw className="w-3.5 h-3.5" strokeWidth={2.5} />
              {t('uploadRetry')}
            </button>
            <button
              onClick={() => dismiss(job.id)}
              className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 active:scale-90 transition touch-manipulation"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4 text-white/60" strokeWidth={2.5} />
            </button>
          </>
        ) : (
          <span className="w-1.5" />
        )}
      </div>
    </div>
  );
}
