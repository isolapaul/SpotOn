/**
 * deleteCategory (item 7): the super admin deletes a category they created, only while no spot
 * uses it and no waiting edit proposes it (checked and deleted in one transaction). Clients cannot
 * delete categories directly (firestore.rules). Logs only {uid, id, outcome}.
 */
import {onCall, HttpsError} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import {assertSuperAdmin} from "../lib/admin";
import {db} from "../lib/app";
import {isValidSpotId} from "../lib/ids";

export const deleteCategory = onCall(async (request) => {
  const uid = await assertSuperAdmin(request, "Only the super admin can delete categories");
  const id: unknown = request.data?.id;
  if (!isValidSpotId(id)) throw new HttpsError("invalid-argument", "Invalid category id");
  try {
    await db.runTransaction(async (tx) => {
      const ref = db.collection("categories").doc(id);
      const [category, spots, edits] = await Promise.all([
        tx.get(ref),
        tx.get(db.collection("spots").where("category", "==", id).limit(1)),
        tx.get(db.collection("spotEdits").where("proposed.category", "==", id).limit(1)),
      ]);
      if (!category.exists) throw new HttpsError("not-found", "Category not found");
      if (!spots.empty || !edits.empty) throw new HttpsError("failed-precondition", "CATEGORY_IN_USE");
      tx.delete(ref);
    });
    logger.info("deleteCategory", {uid, id, outcome: "deleted"});
    return {deleted: true};
  } catch (error) {
    logger.info("deleteCategory", {uid, id, outcome: error instanceof HttpsError ? error.code : "error"});
    throw error;
  }
});
