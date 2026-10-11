/**
 * Anonymous telemetry (growth plan §1); signed-in or not:
 * - logEvents {events: string[], platform}: adds the known events to today's counters
 *   (stats/{day}.{event}.{platform}).
 * - reportClientError {message, stack, path, version, platform}: stores the cleaned report once per
 *   distinct error (clientErrors/{hash}) with a count, first and last seen.
 * Both are server-only collections; the super admin reads them (rules).
 */
import {FieldValue} from "firebase-admin/firestore";
import {onCall} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import {db} from "../lib/app";
import {cleanErrorReport, countEvents, dayKey, errorHash, platformOf} from "../lib/telemetry";

export const logEvents = onCall(async (request) => {
  const counts = countEvents(request.data?.events);
  if (!counts.size) return {ok: true};
  const platform = platformOf(request.data?.platform);
  const patch: Record<string, unknown> = {updatedAt: FieldValue.serverTimestamp()};
  for (const [name, n] of counts) patch[`${name}.${platform}`] = FieldValue.increment(n);
  const ref = db.collection("stats").doc(dayKey(Date.now()));
  // update() takes dotted paths as nested fields; the day's doc is created on its first event.
  try {
    await ref.update(patch);
  } catch (error) {
    if ((error as {code?: unknown})?.code !== 5) throw error;
    const nested: Record<string, unknown> = {updatedAt: FieldValue.serverTimestamp()};
    for (const [name, n] of counts) nested[name] = {[platform]: FieldValue.increment(n)};
    await ref.set(nested, {merge: true});
  }
  return {ok: true};
});

export const reportClientError = onCall(async (request) => {
  const report = cleanErrorReport(request.data);
  if (!report) return {ok: false};
  const hash = errorHash(report);
  const ref = db.collection("clientErrors").doc(hash);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) {
      tx.update(ref, {
        count: FieldValue.increment(1), lastSeen: FieldValue.serverTimestamp(), path: report.path,
      });
    } else {
      const now = FieldValue.serverTimestamp();
      tx.set(ref, {...report, count: 1, firstSeen: now, lastSeen: now});
    }
  });
  logger.info("reportClientError", {hash, platform: report.platform, version: report.version});
  return {ok: true};
});
