/**
 * Anonymous telemetry (growth plan §1), pure:
 * - daily counters per event and platform (stats/{yyyy-mm-dd}), from a fixed list of events;
 * - client error reports, cleaned of anything personal and deduplicated by a hash.
 * Nothing here identifies a person: no uid, no device id, no free text from users.
 */
import {createHash} from "node:crypto";

export const EVENT_NAMES = [
  "app_open", "sign_up", "spot_submitted", "first_spot", "review_written", "follow", "invite_claimed",
  "invite_shared", "spot_shared", "share_card", "visit", "challenge_done", "list_shared", "review_prompt",
] as const;
export type EventName = typeof EVENT_NAMES[number];

export const PLATFORMS = ["web", "ios", "android"] as const;
export type Platform = typeof PLATFORMS[number];

/** At most this many events per call. */
export const MAX_EVENTS = 20;

export function isEventName(x: unknown): x is EventName {
  return typeof x === "string" && (EVENT_NAMES as readonly string[]).includes(x);
}

export function platformOf(x: unknown): Platform {
  return typeof x === "string" && (PLATFORMS as readonly string[]).includes(x) ? x as Platform : "web";
}

/** The UTC day of a moment, "2026-10-11". */
export function dayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** The valid events of a call, counted ("app_open" twice → 2), at most MAX_EVENTS. */
export function countEvents(events: unknown): Map<EventName, number> {
  const counts = new Map<EventName, number>();
  if (!Array.isArray(events)) return counts;
  for (const name of events.slice(0, MAX_EVENTS)) {
    if (isEventName(name)) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return counts;
}

const LIMITS = {message: 300, stack: 1200, path: 120, version: 20};

/**
 * Removes what could identify someone from error text: e-mail addresses, long ids and tokens,
 * query strings and fragments of URLs. Spot ids in paths stay recognisable as ":id".
 */
export function scrub(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "<email>")
    .replace(/(https?:\/\/[^\s?#)]+)[?#][^\s)]*/g, "$1")
    .replace(/\b[A-Za-z0-9_-]{20,}\b/g, ":id");
}

function text(x: unknown, max: number): string {
  return typeof x === "string" ? scrub(x).slice(0, max) : "";
}

export interface ErrorReport {
  message: string;
  stack: string;
  path: string;
  version: string;
  platform: Platform;
}

/** A client report cleaned and cut to size, or null when it has no message. */
export function cleanErrorReport(data: unknown): ErrorReport | null {
  const d = (typeof data === "object" && data !== null ? data : {}) as Record<string, unknown>;
  const message = text(d.message, LIMITS.message).trim();
  if (!message) return null;
  const path = typeof d.path === "string" ? d.path.split(/[?#]/)[0] : "";
  return {
    message,
    stack: text(d.stack, LIMITS.stack),
    path: scrub(path).slice(0, LIMITS.path),
    version: typeof d.version === "string" && /^[\w.-]+$/.test(d.version) ? d.version.slice(0, LIMITS.version) : "",
    platform: platformOf(d.platform),
  };
}

/** One document per distinct error: the message, the first stack line, the platform and version. */
export function errorHash(report: ErrorReport): string {
  const firstFrame = report.stack.split("\n").find((line) => line.includes("at ") || line.includes("@")) ?? "";
  return createHash("sha1")
    .update([report.message, firstFrame.trim(), report.platform, report.version].join("|"))
    .digest("hex")
    .slice(0, 24);
}
