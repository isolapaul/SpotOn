/**
 * Pure moderation helpers (item 4): reasons, the edit proposal of an approved spot, applying it.
 * No Firebase imports.
 *
 * Agreed with Paul (2026-09-30): every rejection or removal needs a reason (1–500 characters),
 * the owner reads it in the app (inbox + push); an owner's edit of an approved spot is a proposal
 * (spotEdits/{spotId}, at most one per spot) that an admin approves or rejects; other users'
 * photos wait in photoSubmissions until an admin approves them.
 */
import {PLACEHOLDER_URL} from "./spotImages";

export const MAX_REASON_LENGTH = 500;

/**
 * The built-in categories (the same list as firestore.rules builtInCategory()); the super admin's
 * own ones are categories/{id} docs.
 */
export const BUILT_IN_CATEGORIES: readonly string[] = [
  "scenic", "smoke-spot", "viewpoint", "other", "hiking", "random", "date-spot", "park", "part",
];

/** A trimmed reason of 1–500 characters, else null. */
export function validReason(x: unknown): string | null {
  if (typeof x !== "string") return null;
  const reason = x.trim();
  return reason.length >= 1 && reason.length <= MAX_REASON_LENGTH ? reason : null;
}

/** The fields an owner may propose for an approved spot (all optional, at least one). */
export interface EditProposal {
  name?: string;
  description?: string;
  category?: string;
  location?: {lat: number; lng: number};
  /** Photos to remove (by URL). */
  removeImageUrls?: string[];
  /** The new primary photo (by URL; must stay on the spot). */
  primaryImageUrl?: string;
}

type DocData = Record<string, unknown>;

function asStrings(x: unknown): string[] {
  return Array.isArray(x) ? x.filter((v): v is string => typeof v === "string") : [];
}

function asImages(x: unknown): DocData[] {
  return Array.isArray(x) ?
    x.filter((v): v is DocData => typeof v === "object" && v !== null && !Array.isArray(v)) : [];
}

function validLocation(x: unknown): x is {lat: number; lng: number} {
  if (typeof x !== "object" || x === null) return false;
  const {lat, lng} = x as {lat?: unknown; lng?: unknown};
  return typeof lat === "number" && lat >= -90 && lat <= 90 &&
    typeof lng === "number" && lng >= -180 && lng <= 180;
}

/**
 * The stored proposal as a clean EditProposal: only valid fields are kept (the rules validate them
 * too; this is the server's own check before applying). `isCategory` decides custom categories.
 */
export function readProposal(x: unknown, isCategory: (id: string) => boolean): EditProposal {
  const p = (typeof x === "object" && x !== null ? x : {}) as DocData;
  const out: EditProposal = {};
  if (typeof p.name === "string" && p.name.trim().length >= 1 && p.name.length <= 100) {
    out.name = p.name.trim();
  }
  if (typeof p.description === "string" && p.description.length <= 2000) {
    out.description = p.description.trim();
  }
  if (typeof p.category === "string" && isCategory(p.category)) out.category = p.category;
  if (validLocation(p.location)) out.location = {lat: p.location.lat, lng: p.location.lng};
  const remove = asStrings(p.removeImageUrls);
  if (remove.length) out.removeImageUrls = remove;
  if (typeof p.primaryImageUrl === "string") out.primaryImageUrl = p.primaryImageUrl;
  return out;
}

export interface EditApplyPlan {
  /** Field updates for spots/{id}. */
  update: DocData;
  /** URLs of the photos the edit removed (their files are deleted afterwards). */
  removedUrls: string[];
}

/**
 * Applies a proposal to the current spot. Photo removals take the photos out of imageUrls and
 * spotImages (the last one leaves the placeholder, as an owner removal always did); the primary
 * photo is set by URL after the removals, else the primary index keeps pointing at the same photo.
 */
export function planEditApply(spot: DocData, proposal: EditProposal): EditApplyPlan {
  const update: DocData = {};
  if (proposal.name !== undefined) update.name = proposal.name;
  if (proposal.description !== undefined) update.description = proposal.description;
  if (proposal.category !== undefined) update.category = proposal.category;
  if (proposal.location !== undefined) update.location = proposal.location;

  const oldUrls = asStrings(spot.imageUrls);
  const oldImages = asImages(spot.spotImages);
  const oldPrimary = typeof spot.primaryImageIndex === "number" ? spot.primaryImageIndex : 0;
  const primaryUrl = oldUrls[oldPrimary];
  const remove = new Set((proposal.removeImageUrls ?? []).filter((u) => u !== PLACEHOLDER_URL));
  const removedUrls = [...new Set([...oldUrls, ...oldImages.map((i) => i.url)])]
    .filter((u): u is string => typeof u === "string" && remove.has(u));

  let urls = oldUrls;
  if (removedUrls.length) {
    urls = oldUrls.filter((u) => !remove.has(u));
    if (urls.length === 0) urls = [PLACEHOLDER_URL];
    update.imageUrls = urls;
    update.spotImages = oldImages.filter((i) => !remove.has(i.url as string));
  }

  const wanted = proposal.primaryImageUrl !== undefined && urls.includes(proposal.primaryImageUrl) ?
    proposal.primaryImageUrl : primaryUrl;
  const index = wanted !== undefined ? urls.indexOf(wanted) : -1;
  const primaryImageIndex = index >= 0 ? index : 0;
  if (removedUrls.length || primaryImageIndex !== oldPrimary) {
    update.primaryImageIndex = primaryImageIndex;
  }
  return {update, removedUrls};
}
