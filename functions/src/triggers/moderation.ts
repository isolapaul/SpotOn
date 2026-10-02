/**
 * Moderation triggers (item 4): a new (or renewed) edit proposal tells the admins, at most once
 * an hour per spot (withdrawing and proposing again cannot spam them; the queue still shows it).
 */
import {onDocumentWritten} from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import {db} from "../lib/app";
import {notifyAdminsToReview} from "../lib/inbox";

const PROPOSAL_NOTICE_COOLDOWN_MS = 60 * 60 * 1000;

export const onSpotEditProposed = onDocumentWritten(
  "spotEdits/{spotId}",
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    // Only when a proposal starts waiting: a new one, or a new one after a rejection. Changes to a
    // proposal that is already waiting do not ping the admins again.
    if (after?.status !== "pending" || before?.status === "pending") return;
    const spotId = event.params.spotId;
    // Server-only doc (rules: no client access to adminNotices).
    const noticeRef = db.collection("adminNotices").doc(`edit_${spotId}`);
    const due = await db.runTransaction(async (tx) => {
      const last = (await tx.get(noticeRef)).get("at");
      const now = Date.now();
      if (typeof last === "number" && now - last < PROPOSAL_NOTICE_COOLDOWN_MS) return false;
      tx.set(noticeRef, {at: now, spotId});
      return true;
    });
    if (!due) {
      logger.info(`Edit proposed for spot ${spotId}, admins notified within the hour`);
      return;
    }
    logger.info(`Edit proposed for spot ${spotId}, notifying admins`);
    await notifyAdminsToReview("editProposed", "editProposedBody",
      [String(after.spotName ?? "")], {type: "edit_proposed", spotId});
  },
);
