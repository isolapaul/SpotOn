/**
 * Blocks (item 8): blockUser / unblockUser. A block ends the follows and requests both ways;
 * neither can follow or open the other's profile, and they do not find each other in the search.
 * The blocked user is not told (to them the profile looks unavailable). Logs only uids and
 * outcomes.
 */
import {DocumentSnapshot, FieldValue, Transaction} from "firebase-admin/firestore";
import {onCall} from "firebase-functions/v2/https";
import {db} from "../lib/app";
import {
  Alive, alive, blockRef, deleteFollow, followRef, logged, requestRef, requireTarget, requireUid,
} from "./followShared";

/** Deletes a follow edge with its counters, if it still exists. */
function dropFollow(
  tx: Transaction,
  follow: DocumentSnapshot,
  follower: string,
  target: string,
  live: Alive,
) {
  if (follow.exists) deleteFollow(tx, follower, target, live);
}

export const blockUser = onCall(async (request) => {
  const uid = requireUid(request);
  const target = requireTarget(request, uid);
  return logged("blockUser", uid, target, async () => {
    await db.runTransaction(async (tx) => {
      const [ab, ba, reqAb, reqBa, block, live] = await Promise.all([
        tx.get(followRef(uid, target)), tx.get(followRef(target, uid)),
        tx.get(requestRef(uid, target)), tx.get(requestRef(target, uid)),
        tx.get(blockRef(uid, target)), alive(tx, uid, target),
      ]);
      dropFollow(tx, ab, uid, target, live);
      dropFollow(tx, ba, target, uid, live);
      if (reqAb.exists) tx.delete(reqAb.ref);
      if (reqBa.exists) tx.delete(reqBa.ref);
      if (!block.exists) {
        const createdAt = FieldValue.serverTimestamp();
        tx.create(blockRef(uid, target), {blocker: uid, blocked: target, createdAt});
      }
    });
    return {blocked: true};
  });
});

export const unblockUser = onCall(async (request) => {
  const uid = requireUid(request);
  const target = requireTarget(request, uid);
  return logged("unblockUser", uid, target, async () => {
    await blockRef(uid, target).delete();
    return {blocked: false};
  });
});
