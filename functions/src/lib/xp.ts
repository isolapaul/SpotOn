/**
 * XP per spot (item 5), pure. Only approved spots earn XP:
 * - its creator: XP_REWARDS.approvedSpot;
 * - everyone else with at least one review on it: XP_REWARDS.review (once per spot);
 * - each real photo: XP_REWARDS.approvedPhoto for whoever added it (legacy photos without
 *   `addedBy` belong to the creator; the placeholder is not a photo).
 * A user's XP is the sum over all spots, so deleting a spot, review or photo takes its XP back.
 * `spots.contributors` (reviewers and photo adders other than the creator) lets the server find
 * the spots a user earns XP from without scanning every spot.
 */
import {DELETED_OWNER} from "./accountDeletion";
import {effectiveLevel, levelForSpotCount, validLevel, XP_REWARDS} from "./levels";
import {PLACEHOLDER_URL} from "./spotImages";

type Data = Record<string, unknown>;

function isUid(x: unknown): x is string {
  return typeof x === "string" && x.length > 0 && x !== DELETED_OWNER;
}

function records(x: unknown): Data[] {
  return Array.isArray(x) ? x.filter((v): v is Data => typeof v === "object" && v !== null) : [];
}

/** Each real photo of a spot once, with the uid it counts for. */
export function spotPhotos(spot: Data): {url: string; addedBy: string}[] {
  const creator = typeof spot.createdBy === "string" ? spot.createdBy : "";
  const byUrl = new Map<string, string>();
  for (const image of records(spot.spotImages)) {
    if (typeof image.url !== "string") continue;
    byUrl.set(image.url, typeof image.addedBy === "string" && image.addedBy ? image.addedBy : creator);
  }
  const urls = Array.isArray(spot.imageUrls) ? spot.imageUrls : [];
  for (const url of urls) {
    if (typeof url === "string" && !byUrl.has(url)) byUrl.set(url, creator);
  }
  byUrl.delete(PLACEHOLDER_URL);
  return [...byUrl].map(([url, addedBy]) => ({url, addedBy}));
}

function reviewerIds(spot: Data): Set<string> {
  return new Set(records(spot.reviews).map((r) => r.userId).filter(isUid));
}

/** The XP each user earns from one spot (empty unless approved). */
export function spotXp(spot: Data | undefined): Map<string, number> {
  const xp = new Map<string, number>();
  if (!spot || spot.status !== "approved") return xp;
  const add = (uid: unknown, points: number) => {
    if (isUid(uid)) xp.set(uid, (xp.get(uid) ?? 0) + points);
  };
  add(spot.createdBy, XP_REWARDS.approvedSpot);
  for (const {addedBy} of spotPhotos(spot)) add(addedBy, XP_REWARDS.approvedPhoto);
  for (const uid of reviewerIds(spot)) {
    if (uid !== spot.createdBy) add(uid, XP_REWARDS.review);
  }
  return xp;
}

/** Reviewers and photo adders other than the creator, sorted (the stored `contributors`). */
export function spotContributors(spot: Data): string[] {
  const uids = new Set([...reviewerIds(spot), ...spotPhotos(spot).map((p) => p.addedBy)]);
  return [...uids].filter((uid) => isUid(uid) && uid !== spot.createdBy).sort();
}

/** True when the stored `contributors` already equals `next`. */
export function sameContributors(stored: unknown, next: readonly string[]): boolean {
  return Array.isArray(stored) && stored.length === next.length &&
    stored.every((uid, i) => uid === next[i]);
}

/** The uids whose XP from this spot differs between two versions of it. */
export function changedXpUids(before: Data | undefined, after: Data | undefined): string[] {
  const a = spotXp(before);
  const b = spotXp(after);
  return [...new Set([...a.keys(), ...b.keys()])].filter((uid) => a.get(uid) !== b.get(uid));
}

/** A user's XP over the given spots (each spot once). */
export function xpOf(uid: string, spots: Iterable<Data>): number {
  let total = 0;
  for (const spot of spots) total += spotXp(spot).get(uid) ?? 0;
  return total;
}

/**
 * The level fields stored on users/{uid}: the floor is frozen the first time (the old
 * spot-count level, every status), then kept.
 */
export function userLevelFields(
  xp: number,
  storedFloor: unknown,
  ownSpotsCount: number,
): {xp: number; level: number; levelFloor: number} {
  const levelFloor = validLevel(storedFloor) ?? levelForSpotCount(ownSpotsCount);
  return {xp, level: effectiveLevel(xp, levelFloor), levelFloor};
}
