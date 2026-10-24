/**
 * Profiles and people search (item 8):
 * - getProfile: what a visitor may see of a profile (approved spot ids, saved spot ids if the owner
 *   shows them) and where the caller stands (following / requested / follows you).
 * - searchUsers: username prefix search (signed in, 2+ characters, 10 results, 20 calls a minute).
 * Blocked users either way do not find each other, and a blocked caller sees the profile as
 * unavailable. Logs only uids and outcomes.
 */
import {DocumentData, DocumentReference, FieldPath} from "firebase-admin/firestore";
import {onCall, HttpsError} from "firebase-functions/v2/https";
import {db} from "../lib/app";
import {canViewProfile, FollowState, isUid, normalizeQuery} from "../lib/follows";
import {checkRate} from "../lib/rateLimit";
import {
  blockedEitherWay, followRef, logged, profileRef, requestRef, requireUid,
} from "./followShared";

const SEARCH_LIMIT = 10;

const MAX_SHARED_LISTS = 30;

interface SharedList {
  id: string;
  name: string;
  spotIds: string[];
}

function sharedList(id: string, d: DocumentData): SharedList | null {
  if (typeof d.name !== "string" || !d.name.trim()) return null;
  const spotIds = Array.isArray(d.spotIds) ?
    d.spotIds.filter((x: unknown): x is string => typeof x === "string") : [];
  return {id, name: d.name.trim(), spotIds};
}

export const getProfile = onCall(async (request) => {
  const caller = request.auth?.uid ?? null;
  const target: unknown = request.data?.uid;
  if (!isUid(target)) throw new HttpsError("invalid-argument", "Invalid uid");
  return logged("getProfile", caller, target, async () => {
    const isSelf = caller === target;
    if (caller && !isSelf) {
      const blocks = await blockedEitherWay(caller, target);
      if (blocks.byB) throw new HttpsError("not-found", "Profile not found");
      if (blocks.byA) return {canView: false, relation: "none", followsYou: false, blocked: true};
    }
    const refs: DocumentReference[] = [db.collection("users").doc(target)];
    if (caller && !isSelf) {
      refs.push(followRef(caller, target), requestRef(caller, target), followRef(target, caller));
    }
    const [userSnap, following, requested, followsYou] = await db.getAll(...refs);
    if (!userSnap.exists) throw new HttpsError("not-found", "Profile not found");
    const isPrivate = userSnap.get("profilePrivate") === true;
    let relation: FollowState = "none";
    if (following?.exists) relation = "following";
    else if (requested?.exists) relation = "requested";
    const canView = canViewProfile({isPrivate, isSelf, following: relation === "following"});
    const base = {canView, relation, followsYou: followsYou?.exists === true};
    if (!canView) return base;

    const spots = await db.collection("spots").where("createdBy", "==", target)
      .where("status", "==", "approved").select().get();
    const saved = userSnap.get("showSaved") === true || isSelf ?
      (Array.isArray(userSnap.get("savedSpots")) ? userSnap.get("savedSpots") : [])
        .filter((id: unknown): id is string => typeof id === "string") :
      null;
    // The owner's lists marked "show on my profile" (the owner reads all of them directly).
    const lists = isSelf ? [] : (await db.collection("users").doc(target).collection("lists")
      .where("shared", "==", true).limit(MAX_SHARED_LISTS).get()).docs
      .map((d) => sharedList(d.id, d.data()))
      .filter((l): l is SharedList => l !== null);
    return {
      ...base,
      spotIds: spots.docs.map((d) => d.id),
      ...(saved ? {savedSpotIds: saved} : {}),
      ...(lists.length ? {lists} : {}),
    };
  });
});

export const searchUsers = onCall(async (request) => {
  const uid = requireUid(request);
  const q = normalizeQuery(request.data?.q);
  if (!q) throw new HttpsError("invalid-argument", "At least 2 characters of a-z, 0-9 or _");
  return logged("searchUsers", uid, null, async () => {
    await db.runTransaction(async (tx) => {
      (await checkRate(tx, uid, "search"))();
    });
    const names = await db.collection("usernames").orderBy(FieldPath.documentId())
      .startAt(q).endAt(q + "\uf8ff").limit(SEARCH_LIMIT).get();
    const found = names.docs.map((d) => d.get("uid")).filter(isUid).filter((u) => u !== uid);
    const blocked = new Set((await Promise.all(found.map(async (u) => {
      const b = await blockedEitherWay(uid, u);
      return b.byA || b.byB ? u : null;
    }))).filter((u): u is string => u !== null));
    const uids = found.filter((u) => !blocked.has(u));
    if (!uids.length) return {results: []};
    const profiles = await db.getAll(...uids.map(profileRef));
    return {
      results: profiles.filter((p) => p.exists).map((p) => ({
        uid: p.id,
        username: String(p.get("username") ?? ""),
        profilePictureURL: typeof p.get("profilePictureURL") === "string" ?
          p.get("profilePictureURL") : null,
        level: typeof p.get("level") === "number" ? p.get("level") : null,
        isPrivate: p.get("isPrivate") === true,
      })),
    };
  });
});
