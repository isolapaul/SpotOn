/**
 * weeklyFeedDigest (Mondays 9:00, Budapest time): a push to everyone whose followed people shared
 * new spots in the past week ("Anna and 2 others shared 5 new spots"). Push only (no inbox item),
 * following the "Follows" notification setting; a tap opens the feed (/feed). Logs only counts.
 */
import {onSchedule} from "firebase-functions/v2/scheduler";
import {Timestamp} from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import {db} from "../lib/app";
import {DELETED_OWNER} from "../lib/accountDeletion";
import {DIGEST_WINDOW_MS, planDigests} from "../lib/digest";
import {sendNotificationToUser} from "../lib/notify";

/** Pushes in flight at once (each reads the user doc and calls FCM). */
const SEND_CHUNK = 50;

export const weeklyFeedDigest = onSchedule(
  {schedule: "0 9 * * 1", timeZone: "Europe/Budapest", timeoutSeconds: 540},
  async () => {
    const since = Timestamp.fromMillis(Date.now() - DIGEST_WINDOW_MS);
    // Single-field ranges (no composite index); the status is checked here. Admins' spots are
    // created approved and carry no approvedAt, so creation time counts for them.
    const [approved, created] = await Promise.all([
      db.collection("spots").where("approvedAt", ">=", since).get(),
      db.collection("spots").where("createdAt", ">=", since).get(),
    ]);
    const seen = new Set<string>();
    const owners = [...approved.docs, ...created.docs]
      .filter((d) => !seen.has(d.id) && seen.add(d.id) && d.get("status") === "approved")
      .map((d) => d.get("createdBy"))
      .filter((o): o is string => typeof o === "string" && o !== "" && o !== DELETED_OWNER);
    if (!owners.length) {
      logger.info("weeklyFeedDigest", {spots: 0, recipients: 0});
      return;
    }
    const followers = new Map<string, string[]>();
    const names = new Map<string, string>();
    await Promise.all([...new Set(owners)].map(async (owner) => {
      const [edges, profile] = await Promise.all([
        db.collection("follows").where("target", "==", owner).select("follower").get(),
        db.collection("publicProfiles").doc(owner).get(),
      ]);
      followers.set(owner, edges.docs.map((d) => String(d.get("follower"))));
      const name = profile.get("username");
      if (typeof name === "string" && name) names.set(owner, name);
    }));
    // A block ends the follows both ways (blockUser), so followers never include blocked pairs.
    const digests = planDigests(owners, followers);
    let failed = 0;
    for (let i = 0; i < digests.length; i += SEND_CHUNK) {
      const results = await Promise.allSettled(digests.slice(i, i + SEND_CHUNK).map((d) => {
        const named = d.owners.find((o) => names.has(o));
        const data = {type: "weekly_digest", link: "/feed"};
        return named ?
          sendNotificationToUser(d.follower, "weeklyDigest", "weeklyDigestBody",
            [names.get(named) ?? "", d.owners.length - 1, d.count], data, "follows") :
          sendNotificationToUser(d.follower, "weeklyDigest", "weeklyDigestBodyNoName",
            [d.count], data, "follows");
      }));
      failed += results.filter((r) => r.status === "rejected").length;
    }
    logger.info("weeklyFeedDigest", {spots: owners.length, recipients: digests.length, failed});
  },
);
