'use client';

import { Check, CircleAlert, Loader2, RotateCw, X } from 'lucide-react';
import { useUploadStore, type UploadJob } from '@/store/useUploadStore';
import { useT } from '@/hooks/useT';
import { Z } from '@/lib/constants';

/** The job the pill shows: a failure first (it needs the user), then running, then just done. */
function pick(jobs: UploadJob[]): UploadJob | undefined {
  return jobs.find((j) => j.status === 'failed') ?? jobs.find((j) => j.status === 'running') ?? jobs.find((j) => j.status === 'done');
}

/** Background upload status (G4): a capsule at the top, clear of the control stack, with Retry on failure. */
export default function UploadStatus() {
  const jobs = useUploadStore((s) => s.jobs);
  const retry = useUploadStore((s) => s.retry);
  const dismiss = useUploadStore((s) => s.dismiss);
  const t = useT();
  const job = pick(jobs);
  if (!job) return null;

  const running = jobs.filter((j) => j.status === 'running').length;
  let icon = <Loader2 className="w-4 h-4 text-brand-400 animate-spin" strokeWidth={2.5} />;
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
      className={`fixed ${Z.floatingButton} flex justify-center pointer-events-none`}
      style={{
        top: 'calc(env(safe-area-inset-top) + 8px)',
        left: 'max(12px, calc(env(safe-area-inset-left) + 8px))',
        right: 'calc(max(12px, calc(env(safe-area-inset-right) + 8px)) + 52px)',
      }}
      role="status"
      aria-live="polite"
    >
      <div
        key={`${job.id}-${job.status}`}
        className="pointer-events-auto max-w-full flex items-center gap-2.5 pl-3.5 pr-2 min-h-[44px] py-1.5 rounded-full material-sheet shadow-float motion-safe:animate-toast-in"
      >
        <span className="flex-shrink-0">{icon}</span>
        <span className={`text-sm text-white/90 ${job.status === 'failed' ? 'line-clamp-2' : 'truncate'}`}>{label}</span>
        {job.status === 'failed' ? (
          <>
            <button
              onClick={() => retry(job.id)}
              className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full bg-brand-600 text-white text-sm font-semibold active:scale-95 transition touch-manipulation"
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
