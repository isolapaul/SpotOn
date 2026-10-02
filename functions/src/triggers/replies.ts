/**
 * onReplyCreated: a reply to a review (a question or an answer) tells the review's author and the
 * spot's owner (never the replier, never someone who blocked the replier).
 */
import {onDocumentCreated} from "firebase-functions/v2/firestore";
import {DocumentData} from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import {db} from "../lib/app";
import {followId} from "../lib/follows";
import {notifyInbox} from "../lib/inbox";

export const onReplyCreated = onDocumentCreated("spots/{spotId}/replies/{replyId}", async (event) => {
  const reply = event.data?.data();
  if (!reply) return;
  const spotId = event.params.spotId;
  const spot = await db.collection("spots").doc(spotId).get();
  if (!spot.exists) return;
  const replier = String(reply.userId ?? "");
  const review = ((spot.get("reviews") ?? []) as DocumentData[]).find((r) => r?.id === reply.reviewId);
  const recipients = new Set([String(review?.userId ?? ""), String(spot.get("createdBy") ?? "")]);
  recipients.delete(replier);
  recipients.delete("");
  const name = String((await db.collection("publicProfiles").doc(replier).get()).get("username") ?? "");
  for (const uid of recipients) {
    if ((await db.collection("blocks").doc(followId(uid, replier)).get()).exists) continue;
    await notifyInbox({uid, type: "review_reply", spotId, spotName: String(spot.get("name") ?? ""),
      actorUid: replier, actorName: name});
  }
  logger.info("onReplyCreated", {spotId, recipients: recipients.size});
});
