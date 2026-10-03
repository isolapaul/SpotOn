/**
 * syncXp (item 5): on every spot write, keeps spots.contributors current and recomputes the XP of
 * each user whose XP from this spot changed (approval, rejection, removal, reviews, photos, owner
 * change). The contributors write triggers this again, but then nothing differs, so nothing loops.
 */
import {onDocumentWritten} from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import {recomputeXp} from "../lib/userLevel";
import {changedXpUids, sameContributors, spotContributors} from "../lib/xp";

export const syncXp = onDocumentWritten("spots/{spotId}", async (event) => {
  const spotId = event.params.spotId;
  const before = event.data?.before.data();
  const after = event.data?.after.data();

  if (after) {
    const contributors = spotContributors(after);
    if (!sameContributors(after.contributors, contributors)) {
      try {
        await event.data!.after.ref.update({contributors});
      } catch (error) {
        // Deleted meanwhile (NOT_FOUND): its own delete event recomputes.
        if ((error as {code?: unknown})?.code !== 5) throw error;
      }
    }
  }

  for (const uid of changedXpUids(before, after)) {
    const outcome = await recomputeXp(uid);
    logger.info("syncXp", {spotId, uid, outcome});
  }
});
