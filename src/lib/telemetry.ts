// Anonymous telemetry (growth plan §1), pure: the event names (KEEP IN SYNC with
// functions/src/lib/telemetry.ts EVENT_NAMES) and turning anything thrown into a short report.

export const TELEMETRY_EVENTS = [
  'app_open', 'sign_up', 'spot_submitted', 'first_spot', 'review_written', 'follow', 'invite_claimed',
  'invite_shared', 'spot_shared', 'share_card', 'visit', 'challenge_done', 'list_shared', 'review_prompt',
] as const;
export type TelemetryEvent = typeof TELEMETRY_EVENTS[number];

/** Errors not worth reporting: network blips, cancelled shares, browser extensions. */
const IGNORED = [/network/i, /Failed to fetch/i, /Load failed/i, /AbortError/i, /cancel/i, /ResizeObserver loop/i, /^Script error\.?$/];

/** A report's message and stack from anything thrown, or null for noise. */
export function errorReportOf(error: unknown): { message: string; stack: string } | null {
  let message = '';
  let stack = '';
  if (error instanceof Error) {
    message = `${error.name}: ${error.message}`;
    stack = error.stack ?? '';
  } else if (typeof error === 'string') {
    message = error;
  } else if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    message = error.message;
  }
  message = message.trim();
  if (!message || IGNORED.some((re) => re.test(message))) return null;
  return { message: message.slice(0, 300), stack: stack.slice(0, 1200) };
}

/** One day of counters, summed over the platforms. */
export interface DayStats {
  day: string;
  totals: Partial<Record<TelemetryEvent, number>>;
  byPlatform: Record<'web' | 'ios' | 'android', number>;
}

/** stats/{day} docs → per-day totals (app_open per platform), newest first. */
export function summarizeStats(docs: ReadonlyArray<{ id: string; data: Record<string, unknown> }>): DayStats[] {
  return docs
    .map(({ id, data }) => {
      const totals: Partial<Record<TelemetryEvent, number>> = {};
      const byPlatform = { web: 0, ios: 0, android: 0 };
      for (const event of TELEMETRY_EVENTS) {
        const counts = data[event];
        if (typeof counts !== 'object' || counts === null) continue;
        let sum = 0;
        for (const [platform, n] of Object.entries(counts as Record<string, unknown>)) {
          if (typeof n !== 'number') continue;
          sum += n;
          if (event === 'app_open' && platform in byPlatform) byPlatform[platform as keyof typeof byPlatform] += n;
        }
        if (sum) totals[event] = sum;
      }
      return { day: id, totals, byPlatform };
    })
    .sort((a, b) => b.day.localeCompare(a.day));
}
