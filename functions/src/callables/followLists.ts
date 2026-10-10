/**
 * getFollowList: who follows a profile, or whom it follows (the profile page's counts open these
 * lists). Signed-in callers only, with the profile page's visibility: a private profile's lists
 * only for the owner and accepted followers. People either side blocked are left out, both the
 * listed users the caller blocked or who blocked the caller. At most FOLLOW_LIST_MAX, newest first.
 */
import {Timestamp} from "firebase-admin/firestore";
import {onCall, HttpsError} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import {db} from "../lib/app";
import {canViewProfile, followId, isUid} from "../lib/follows";
import {checkRate} from "../lib/rateLimit";
import {listedPeople} from "../lib/followLists";

/** Enough for any SpotOn profile today; the list says when it is cut. */
export const FOLLOW_LIST_MAX = 200;
/** Edges read before the newest-first cut (equality-only query, no composite index). */
const FOLLOW_LIST_READ = 1000;

export const getFollowList = onCall(async (request) => {
  const caller = request.auth?.uid;
  if (!caller) throw new HttpsError("unauthenticated", "User must be authenticated");
  const target: unknown = request.data?.uid;
  const kind: unknown = request.data?.kind;
  if (!isUid(target)) throw new HttpsError("invalid-argument", "Invalid uid");
  if (kind !== "followers" && kind !== "following") {
    throw new HttpsError("invalid-argument", "Invalid kind");
  }
  try {
    await db.runTransaction(async (tx) => {
      (await checkRate(tx, caller, "followList"))();
    });
    const isSelf = caller === target;
    const blocks = db.collection("blocks");
    const [userSnap, following, blockedByMe, blockedMe] = await Promise.all([
      db.collection("users").doc(target).get(),
      isSelf ? null : db.collection("follows").doc(followId(caller, target)).get(),
      blocks.where("blocker", "==", caller).select("blocked").get(),
      blocks.where("blocked", "==", caller).select("blocker").get(),
    ]);
    const hidden = new Set<string>([
      ...blockedByMe.docs.map((d) => String(d.get("blocked"))),
      ...blockedMe.docs.map((d) => String(d.get("blocker"))),
    ]);
    if (!userSnap.exists || hidden.has(target)) throw new HttpsError("not-found", "Profile not found");
    const canView = canViewProfile({
      isPrivate: userSnap.get("profilePrivate") === true, isSelf, following: following?.exists === true,
    });
    if (!canView) throw new HttpsError("permission-denied", "PROFILE_PRIVATE");

    const side = kind === "followers" ? "target" : "follower";
    const other = kind === "followers" ? "follower" : "target";
    const edges = await db.collection("follows").where(side, "==", target)
      .limit(FOLLOW_LIST_READ).get();
    const uids = edges.docs
      .map((d) => ({
        uid: d.get(other),
        at: d.get("createdAt") instanceof Timestamp ? (d.get("createdAt") as Timestamp).toMillis() : 0,
      }))
      .filter((e): e is {uid: string; at: number} => isUid(e.uid) && !hidden.has(e.uid))
      .sort((a, b) => b.at - a.at)
      .slice(0, FOLLOW_LIST_MAX)
      .map((e) => e.uid);
    const refs = uids.map((u) => db.collection("publicProfiles").doc(u));
    const profiles = refs.length ? await db.getAll(...refs) : [];
    const people = listedPeople(
      profiles.map((p) => ({id: p.id, exists: p.exists, data: p.data()})),
    );
    logger.info("getFollowList", {uid: caller, target, kind, count: people.length, outcome: "ok"});
    return {people, truncated: edges.size > FOLLOW_LIST_MAX};
  } catch (error) {
    logger.info("getFollowList", {uid: caller, target, kind,
      outcome: error instanceof HttpsError ? error.code : "error"});
    throw error;
  }
});
