/**
 * Spot views and visits (growth plan §3, §4), pure. Counts live in spotStats/{spotId} (server-only
 * writes, public read) so a view never rewrites the spot doc that every map client listens to;
 * rollupSpotStats copies them onto the spots once a day (viewCount, visitCount) for sorting.
 * One counted view per person, spot and UTC day (viewMarks); owners' own views do not count.
 * ownerStats/{uid}: the owner's views in one week (weekly digest).
 */
import {dayKey} from "./telemetry";

export function viewMarkId(spotId: string, uid: string): string {
  return `${spotId}_${uid}`;
}

/** The Monday (UTC) of the week a moment falls in, "2026-10-05". */
export function weekKey(ms: number): string {
  const d = new Date(ms);
  const offset = (d.getUTCDay() + 6) % 7; // days since Monday
  return dayKey(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - offset));
}

/** The previous week's key. */
export function lastWeekKey(ms: number): string {
  return weekKey(ms - 7 * 24 * 60 * 60 * 1000);
}

/** Whether a view at `now` counts, given the day of the person's last counted view of the spot. */
export function viewCounts(lastDay: unknown, now: number): boolean {
  return lastDay !== dayKey(now);
}

/** The owner's weekly views after one more view (a new week starts again at 1). */
export function nextWeekViews(
  stored: {week?: unknown; views?: unknown} | undefined,
  now: number,
): {week: string; views: number} {
  const week = weekKey(now);
  const views = stored?.week === week && typeof stored.views === "number" ? stored.views : 0;
  return {week, views: views + 1};
}

/** Views worth telling an owner about in the weekly digest. */
export const VIEWS_DIGEST_MIN = 3;
