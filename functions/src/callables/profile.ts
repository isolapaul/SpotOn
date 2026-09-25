/**
 * Profile callables (T09):
 * - claimUsername: transactional, uniqueness-enforcing username registry
 *   (usernames/{name} = {uid}).
 * - updateNameStyle: level-5-gated, allowlisted custom name colour/font.
 * Error messages are the exact English strings the client shows via error.message.
 * Logs only {uid, outcome}: never payloads.
 */
import {FieldValue} from "firebase-admin/firestore";
import {onCall, HttpsError, CallableRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import {db} from "../lib/app";
import {calculateLevel, NAME_STYLE_MIN_LEVEL} from "../lib/levels";
import {
  NameStyleValidationError,
  normalizeUsername,
  validateNameStylePatch,
} from "../lib/profiles";

function requireUid(request: CallableRequest): string {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "User must be authenticated");
  }
  return uid;
}

function outcomeOf(error: unknown): string {
  return error instanceof HttpsError ? error.code : "error";
}

export const claimUsername = onCall(async (request) => {
  const uid = requireUid(request);
  try {
    const name = normalizeUsername(request.data?.username);
    if (!name) {
      throw new HttpsError(
        "invalid-argument",
        "Username must be 3-20 characters of a-z, 0-9 or _",
      );
    }

    const usernames = db.collection("usernames");
    const userRef = db.collection("users").doc(uid);

    const outcome = await db.runTransaction(async (tx) => {
      // Reads first.
      const reg = await tx.get(usernames.doc(name));
      const user = await tx.get(userRef);
      if (!user.exists) {
        throw new HttpsError("failed-precondition", "User profile missing");
      }
      // Transitional guard: users not yet registered by the backfill.
      const legacy = reg.exists ? null :
        await tx.get(db.collection("users").where("username", "==", name).limit(2));
      const current: unknown = user.get("username");
      const old = normalizeUsername(current);
      const oldReg = old && old !== name ? await tx.get(usernames.doc(old)) : null;

      // Decide.
      if ((reg.exists && reg.get("uid") !== uid) ||
          (legacy && legacy.docs.some((doc) => doc.id !== uid))) {
        throw new HttpsError("already-exists", "Username is already taken");
      }
      if (current === name && reg.exists && reg.get("uid") === uid) {
        return "unchanged";
      }

      // Write.
      if (oldReg?.exists && oldReg.get("uid") === uid) {
        tx.delete(oldReg.ref);
      }
      tx.set(usernames.doc(name), {uid});
      tx.update(userRef, {username: name});
      return "claimed";
    });

    logger.info("claimUsername", {uid, outcome});
    return {username: name};
  } catch (error) {
    logger.info("claimUsername", {uid, outcome: outcomeOf(error)});
    throw error;
  }
});

export const updateNameStyle = onCall(async (request) => {
  const uid = requireUid(request);
  try {
    let patch;
    try {
      patch = validateNameStylePatch(request.data);
    } catch (error) {
      if (error instanceof NameStyleValidationError) {
        throw new HttpsError("invalid-argument", error.message);
      }
      throw error;
    }

    // Live count, all statuses (D8).
    const n = (await db.collection("spots").where("createdBy", "==", uid).count().get())
      .data().count;
    if (calculateLevel(n) < NAME_STYLE_MIN_LEVEL) {
      throw new HttpsError("permission-denied", "Level 5 required");
    }

    const update: Record<string, string | FieldValue> = {};
    if (patch.color !== undefined) {
      update.customNameColor = patch.color ?? FieldValue.delete();
    }
    if (patch.font !== undefined) {
      update.customNameFont = patch.font ?? FieldValue.delete();
    }
    try {
      await db.collection("users").doc(uid).update(update);
    } catch (error) {
      // update() on a missing doc fails with NOT_FOUND (5); same message as claimUsername.
      if ((error as {code?: unknown})?.code === 5) {
        throw new HttpsError("failed-precondition", "User profile missing");
      }
      throw error;
    }

    logger.info("updateNameStyle", {uid, outcome: "updated"});
    return {success: true};
  } catch (error) {
    logger.info("updateNameStyle", {uid, outcome: outcomeOf(error)});
    throw error;
  }
});
