/**
 * Moderation triggers (item 4): a new (or renewed) edit proposal tells the admins.
 */
import {onDocumentWritten} from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import "../lib/app";
import {notifyAdminsToReview} from "../lib/inbox";

export const onSpotEditProposed = onDocumentWritten(
  "spotEdits/{spotId}",
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    // Only when a proposal starts waiting: a new one, or a new one after a rejection. Changes to a
    // proposal that is already waiting do not ping the admins again.
    if (after?.status !== "pending" || before?.status === "pending") return;
    const spotId = event.params.spotId;
    logger.info(`Edit proposed for spot ${spotId}, notifying admins`);
    await notifyAdminsToReview("editProposed", "editProposedBody",
      [String(after.spotName ?? "")], {type: "edit_proposed", spotId});
  },
);
