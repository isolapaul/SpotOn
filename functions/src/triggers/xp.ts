/**
 * syncXp (item 5): on every spot write, keeps spots.contributors current and syncs the level of
 * each user whose XP from this spot changed (approval, rejection, removal, reviews, photos, owner
 * change), and of a new owner (their pin icon, item 6). A spot of a deleted account loses its pin.
 * Its own writes trigger this again, but then nothing differs, so nothing loops.
 */
import {onDocumentWritten} from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import {FieldValue} from "firebase-admin/firestore";
import {DELETED_OWNER} from "../lib/accountDeletion";
import {syncUserLevel} from "../lib/userLevel";
import {changedXpUids, sameContributors, spotContributors} from "../lib/xp";

export const syncXp = onDocumentWritten("spots/{spotId}", async (event) => {
  const spotId = event.params.spotId;
  const before = event.data?.before.data();
  const after = event.data?.after.data();

  const owner = after?.createdBy;
  const realOwner = typeof owner === "string" && owner.length > 0 && owner !== DELETED_OWNER;
  if (after) {
    const patch: Record<string, unknown> = {};
    const contributors = spotContributors(after);
    if (!sameContributors(after.contributors, contributors)) patch.contributors = contributors;
    if (!realOwner && after.ownerPin !== undefined) patch.ownerPin = FieldValue.delete();
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
  for (const uid of uids) {
    const outcome = await syncUserLevel(uid);
    logger.info("syncXp", {spotId, uid, outcome});
  }
});
