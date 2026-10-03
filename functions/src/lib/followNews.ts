/**
 * Tells a spot owner's followers that a new spot of theirs is on the map (item 8): once, when the
 * spot becomes approved (or is created approved by an admin). Never for the deleted-user owner.
 */
import * as logger from "firebase-functions/logger";
import {db} from "./app";
import {DELETED_OWNER} from "./accountDeletion";
import {notifyInbox} from "./inbox";

export async function notifyFollowersOfSpot(owner: unknown, spotId: string, spotName: string) {
  if (typeof owner !== "string" || !owner || owner === DELETED_OWNER) return;
  const [followers, profile] = await Promise.all([
    db.collection("follows").where("target", "==", owner).get(),
    db.collection("publicProfiles").doc(owner).get(),
  ]);
  if (followers.empty) return;
  const actorName = String(profile.get("username") ?? "");
  await Promise.allSettled(followers.docs.map((d) => notifyInbox({
    uid: String(d.get("follower")), type: "followed_spot", spotId, spotName,
    actorUid: owner, actorName,
  })));
  logger.info("notifyFollowersOfSpot", {spotId, followers: followers.size});
}
