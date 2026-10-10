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

export const weeklyFeedDigest = onSchedule(
  {schedule: "0 9 * * 1", timeZone: "Europe/Budapest"},
  async () => {
    const since = Timestamp.fromMillis(Date.now() - DIGEST_WINDOW_MS);
    // Single-field range (no composite index); the status is checked here.
    const spots = await db.collection("spots").where("approvedAt", ">=", since).get();
    const owners = spots.docs
      .filter((d) => d.get("status") === "approved")
      .map((d) => d.get("createdBy"))
      .filter((o): o is string => typeof o === "string" && o !== "" && o !== DELETED_OWNER);
    if (!owners.length) {
      logger.info("weeklyFeedDigest", {spots: 0, sent: 0});
      return;
    }
    const unique = [...new Set(owners)];
    const followers = new Map<string, string[]>();
    const names = new Map<string, string>();
    await Promise.all(unique.map(async (owner) => {
      const [edges, profile] = await Promise.all([
        db.collection("follows").where("target", "==", owner).get(),
        db.collection("publicProfiles").doc(owner).get(),
      ]);
      followers.set(owner, edges.docs.map((d) => String(d.get("follower"))));
      names.set(owner, String(profile.get("username") ?? ""));
    }));
    const blocks = new Set((await db.collection("blocks").get()).docs.map((d) => d.id));
    const digests = planDigests(owners, followers, (a, b) => blocks.has(`${a}_${b}`));
    const results = await Promise.allSettled(digests.map((d) => {
      const first = names.get(d.owners[0]) ?? "";
      return sendNotificationToUser(d.follower, "weeklyDigest", "weeklyDigestBody",
        [first, d.owners.length - 1, d.count], {type: "weekly_digest", link: "/feed"}, "follows");
    }));
    logger.info("weeklyFeedDigest", {
      spots: owners.length, recipients: digests.length,
      failed: results.filter((r) => r.status === "rejected").length,
    });
  },
);
