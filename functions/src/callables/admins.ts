/**
 * Super-admin-only admin management callables.
 * Error messages are the exact English strings the client shows via error.message.
 * Logs only {callerUid, targetUid, outcome}: never emails or payloads.
 */
import {FieldValue} from "firebase-admin/firestore";
import {UserRecord} from "firebase-admin/auth";
import {onCall, HttpsError} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import {auth, db} from "../lib/app";
import {assertSuperAdmin, normalizeEmail} from "../lib/admin";

interface ResolvedUser {
  uid: string;
  email: string;
  username: string;
  photoURL: string;
}

function hasCode(error: unknown, code: string | number): boolean {
  return typeof error === "object" && error !== null &&
    (error as {code?: unknown}).code === code;
}

async function resolveUserByEmail(input: unknown): Promise<ResolvedUser> {
  const email = normalizeEmail(input);
  if (!email) {
    throw new HttpsError("invalid-argument", "Invalid email");
  }

  let userRecord: UserRecord;
  try {
    userRecord = await auth.getUserByEmail(email);
  } catch (error) {
    if (hasCode(error, "auth/user-not-found")) {
      throw new HttpsError("not-found", "User not found");
    }
    if (hasCode(error, "auth/invalid-email")) {
      throw new HttpsError("invalid-argument", "Invalid email");
    }
    throw error;
  }

  const userDoc = await db.collection("users").doc(userRecord.uid).get();
  const users = userDoc.data() ?? {};
  return {
    uid: userRecord.uid,
    email: userRecord.email ?? email,
    username: users.username || userRecord.displayName || "user",
    photoURL: users.profilePictureURL || users.photoURL || userRecord.photoURL || "",
  };
}

function logOutcome(
  name: string,
  callerUid: string,
  targetUid: string | null,
  outcome: string,
): void {
  logger.info(name, {callerUid, targetUid, outcome});
}

export const lookupUserByEmail = onCall(async (request) => {
  const callerUid = await assertSuperAdmin(request, "Only Super Admin can search users");
  try {
    const user = await resolveUserByEmail(request.data?.email);
    logOutcome("lookupUserByEmail", callerUid, user.uid, "found");
    return user;
  } catch (error) {
    logOutcome("lookupUserByEmail", callerUid, null,
      error instanceof HttpsError ? error.code : "error");
    throw error;
  }
});

export const addAdmin = onCall(async (request) => {
  const callerUid = await assertSuperAdmin(request, "Only Super Admin can add admins");
  let targetUid: string | null = null;
  try {
    const user = await resolveUserByEmail(request.data?.email);
    targetUid = user.uid;

    const adminRef = db.collection("admins").doc(user.uid);
    if ((await adminRef.get()).exists) {
      throw new HttpsError("already-exists", "User is already an admin");
    }

    try {
      await adminRef.create({
        email: user.email,
        username: user.username,
        photoURL: user.photoURL,
        addedAt: FieldValue.serverTimestamp(),
        addedBy: callerUid,
        role: "admin",
      });
    } catch (error) {
      // gRPC ALREADY_EXISTS (6): lost a race with a concurrent add.
      if (hasCode(error, 6)) {
        throw new HttpsError("already-exists", "User is already an admin");
      }
      throw error;
    }

    logOutcome("addAdmin", callerUid, targetUid, "added");
    return {uid: user.uid, username: user.username};
  } catch (error) {
    logOutcome("addAdmin", callerUid, targetUid,
      error instanceof HttpsError ? error.code : "error");
    throw error;
  }
});

export const removeAdmin = onCall(async (request) => {
  const callerUid = await assertSuperAdmin(request, "Only Super Admin can remove admins");
  const uid: unknown = request.data?.uid;
  if (typeof uid !== "string" || uid.length === 0 || uid.length > 128) {
    logOutcome("removeAdmin", callerUid, null, "invalid-argument");
    throw new HttpsError("invalid-argument", "Invalid uid");
  }

  const adminRef = db.collection("admins").doc(uid);
  const snap = await adminRef.get();
  if (!snap.exists) {
    logOutcome("removeAdmin", callerUid, uid, "not-found");
    throw new HttpsError("not-found", "Admin not found");
  }
  if (snap.get("role") === "super") {
    logOutcome("removeAdmin", callerUid, uid, "failed-precondition");
    throw new HttpsError("failed-precondition", "Cannot remove a super admin");
  }

  await adminRef.delete();
  logOutcome("removeAdmin", callerUid, uid, "removed");
  return {success: true};
});
