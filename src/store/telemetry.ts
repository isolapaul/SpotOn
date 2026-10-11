// Anonymous telemetry (growth plan §1): event counters and client error reports, sent to the
// logEvents / reportClientError callables. Nothing here carries a user id. Failures are silent.
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { APP_VERSION } from '@/lib/constants';
import { nativePlatform } from '@/lib/nativeApp';
import { errorReportOf, type TelemetryEvent } from '@/lib/telemetry';

const logEventsCallable = httpsCallable<{ events: TelemetryEvent[]; platform: string }, unknown>(functions, 'logEvents');
const reportErrorCallable = httpsCallable<Record<string, string>, unknown>(functions, 'reportClientError');

const FLUSH_MS = 5000;
const MAX_ERRORS_PER_SESSION = 10;

let queue: TelemetryEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
const sentErrors = new Set<string>();

const platform = () => nativePlatform() ?? 'web';

function flush() {
  if (timer) clearTimeout(timer);
  timer = null;
  if (!queue.length) return;
  const events = queue;
  queue = [];
  logEventsCallable({ events, platform: platform() }).catch(() => {});
}

/** Counts one anonymous event (batched, sent within a few seconds or when the app goes away). */
export function track(event: TelemetryEvent): void {
  if (typeof window === 'undefined') return;
  queue.push(event);
  timer ??= setTimeout(flush, FLUSH_MS);
}

/** Sends a cleaned error report once per distinct message and session (at most 10 a session). */
export function reportError(error: unknown): void {
  if (typeof window === 'undefined') return;
  const report = errorReportOf(error);
  if (!report || sentErrors.has(report.message) || sentErrors.size >= MAX_ERRORS_PER_SESSION) return;
  sentErrors.add(report.message);
  reportErrorCallable({ ...report, path: globalThis.location.pathname, version: APP_VERSION, platform: platform() }).catch(() => {});
}

let installed = false;

/** Global error listeners and the flush on hide; once per page. */
export function installTelemetry(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('error', (e) => reportError(e.error ?? e.message));
  window.addEventListener('unhandledrejection', (e) => reportError(e.reason));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
}
