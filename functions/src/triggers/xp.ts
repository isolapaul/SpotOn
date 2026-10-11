/**
 * syncXp (item 5): on every spot write, keeps spots.contributors current and syncs the level of
 * each user whose XP from this spot changed (approval, rejection, removal, reviews, photos, owner
 * change), and of a new owner (their pin icon, item 6). A spot of a deleted account loses its pin.
 * Its own writes trigger this again, but then nothing differs, so nothing loops.
 */
import {onDocumentWritten} from "firebase-functions/v2/firestore";
import {onlyLikeCountChanged} from "../lib/spotLikes";
import * as logger from "firebase-functions/logger";
import {FieldValue} from "firebase-admin/firestore";
import {DELETED_OWNER} from "../lib/accountDeletion";
import {syncUserLevel} from "../lib/userLevel";
import {changedXpUids, sameContributors, spotContributors} from "../lib/xp";
import {db} from "../lib/app";

/**
 * Marks an invitee's referral as having an approved spot (once); returns the inviter whose XP
 * changes, else null.
 */
async function markInviteeSpotApproved(invitee: string): Promise<string | null> {
  const ref = db.collection("referrals").doc(invitee);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists || snap.get("spotApproved") === true) return null;
    tx.update(ref, {spotApproved: true});
    const referrer = snap.get("referrer");
    return typeof referrer === "string" ? referrer : null;
  });
}

export const syncXp = onDocumentWritten("spots/{spotId}", async (event) => {
  const spotId = event.params.spotId;
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  // A like only moves likeCount: no XP or contributor change, and no extra read.
  if (onlyLikeCountChanged(before, after)) return;

  const owner = after?.createdBy;
  const realOwner = typeof owner === "string" && owner.length > 0 && owner !== DELETED_OWNER;
  if (after) {
    // The stored fields come from the spot as it is now: events may arrive out of order, and an
    // older snapshot must not overwrite newer contributors.
    const current = (await event.data!.after.ref.get()).data();
    const currentOwner = current?.createdBy;
    const currentReal = typeof currentOwner === "string" && currentOwner.length > 0 &&
      currentOwner !== DELETED_OWNER;
    const patch: Record<string, unknown> = {};
    if (current) {
      const contributors = spotContributors(current);
      if (!sameContributors(current.contributors, contributors)) patch.contributors = contributors;
      if (!currentReal && current.ownerPin !== undefined) patch.ownerPin = FieldValue.delete();
    }
    if (Object.keys(patch).length) {
      try {
        await event.data!.after.ref.update(patch);
      } catch (error) {
        // Deleted meanwhile (NOT_FOUND): its own delete event recomputes.
        if ((error as {code?: unknown})?.code !== 5) throw error;
      }
    }
  }

  const uids = new Set(changedXpUids(before, after));
  if (realOwner && before?.createdBy !== owner) uids.add(owner);
  // Referral program: the first approved spot of an invited user earns their inviter a bonus.
  if (realOwner && after?.status === "approved" && before?.status !== "approved") {
    const inviter = await markInviteeSpotApproved(owner);
    if (inviter) uids.add(inviter);
  }
  for (const uid of uids) {
    const outcome = await syncUserLevel(uid);
    logger.info("syncXp", {spotId, uid, outcome});
  }
});
