/**
 * Server-side admin identity: a user is an admin when admins/{uid} exists;
 * the super admin is the one whose doc has role == "super".
 */
import {CallableRequest, HttpsError} from "firebase-functions/v2/https";
import {db} from "./app";

export type AdminRole = "super" | "admin";

export async function getAdminRole(uid: string): Promise<AdminRole | null> {
  const snap = await db.collection("admins").doc(uid).get();
  if (!snap.exists) return null;
  return snap.get("role") === "super" ? "super" : "admin";
}

/** Throws unless the caller is the super admin; returns the caller's uid. */
export async function assertSuperAdmin(
  request: CallableRequest,
  message: string,
): Promise<string> {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "User must be authenticated");
  }
  if ((await getAdminRole(uid)) !== "super") {
    throw new HttpsError("permission-denied", message);
  }
  return uid;
}

/** Trim + lowercase; null unless a string of 3–254 chars with exactly one "@". */
export function normalizeEmail(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const email = input.trim().toLowerCase();
  if (email.length < 3 || email.length > 254) return null;
  if (email.split("@").length !== 2) return null;
  return email;
}
