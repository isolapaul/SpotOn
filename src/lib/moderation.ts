// Moderation (item 4): reasons, owner edit proposals and the admin's view of them. Pure: no React,
// Firebase or DOM. The server applies proposals itself (functions/src/lib/moderation.ts).
import type { Spot } from '@/store/useSpotStore';
import { getThumbnailUrl, PLACEHOLDER_URL } from './spotImages';

/** The longest reason an admin may give (the server enforces the same). */
export const MAX_REASON_LENGTH = 500;

/** A trimmed reason of 1–500 characters, else null. */
export function validReason(text: string): string | null {
  const reason = text.trim();
  return reason.length >= 1 && reason.length <= MAX_REASON_LENGTH ? reason : null;
}

/** What an owner proposes for an approved spot (spotEdits/{spotId}.proposed). */
export interface EditProposal {
  name?: string;
  description?: string;
  category?: string;
  location?: { lat: number; lng: number };
  removeImageUrls?: string[];
  primaryImageUrl?: string;
}

/** An edit proposal: waiting for review, or rejected with a reason (until replaced or dismissed). */
export interface SpotEdit {
  spotId: string;
  spotName: string;
  ownerId: string;
  status: 'pending' | 'rejected';
  proposed: EditProposal;
  reason?: string;
}

/** A photo waiting for approval (photoSubmissions/{id}). */
export interface PhotoSubmission {
  id: string;
  spotId: string;
  spotName: string;
  uploader: string;
  url: string;
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

/** A spotEdits document, or null when it is not a usable proposal. */
export function parseSpotEdit(id: string, data: unknown): SpotEdit | null {
  if (!isRecord(data) || (data.status !== 'pending' && data.status !== 'rejected') || !isRecord(data.proposed)) return null;
  const rejection = isRecord(data.rejection) && typeof data.rejection.reason === 'string' ? data.rejection.reason : undefined;
  return {
    spotId: id,
    spotName: typeof data.spotName === 'string' ? data.spotName : '',
    ownerId: typeof data.ownerId === 'string' ? data.ownerId : '',
    status: data.status,
    proposed: data.proposed as EditProposal,
    ...(rejection ? { reason: rejection } : {}),
  };
}

/** A photoSubmissions document, or null. */
export function parsePhotoSubmission(id: string, data: unknown): PhotoSubmission | null {
  if (!isRecord(data) || typeof data.url !== 'string' || typeof data.spotId !== 'string') return null;
  return {
    id,
    spotId: data.spotId,
    spotName: typeof data.spotName === 'string' ? data.spotName : '',
    uploader: typeof data.uploader === 'string' ? data.uploader : '',
    url: data.url,
  };
}

function sameLocation(a?: { lat: number; lng: number }, b?: { lat: number; lng: number }): boolean {
  return !!a && !!b && a.lat === b.lat && a.lng === b.lng;
}

/**
 * Adds `patch` to a waiting proposal (or starts one) and drops what would change nothing: a field
 * equal to the spot's current value, a removal of a photo the spot does not have, a primary photo
 * that already is the primary or is being removed.
 */
export function mergeProposal(spot: Spot, existing: EditProposal | undefined, patch: EditProposal): EditProposal {
  const merged: EditProposal = { ...existing, ...patch };
  const out: EditProposal = {};
  if (merged.name !== undefined && merged.name !== spot.name) out.name = merged.name;
  if (merged.description !== undefined && merged.description !== (spot.description ?? '')) out.description = merged.description;
  if (merged.category !== undefined && merged.category !== spot.category) out.category = merged.category;
  if (merged.location && !sameLocation(merged.location, spot.location)) out.location = merged.location;

  const urls = new Set([...(spot.imageUrls ?? []), ...(spot.spotImages ?? []).map((i) => i.url)]);
  const removals = [...new Set([...(existing?.removeImageUrls ?? []), ...(patch.removeImageUrls ?? [])])]
    .filter((url) => url !== PLACEHOLDER_URL && urls.has(url));
  if (removals.length) out.removeImageUrls = removals;
  const primary = merged.primaryImageUrl;
  if (primary && !removals.includes(primary) && primary !== getThumbnailUrl(spot) && urls.has(primary)) {
    out.primaryImageUrl = primary;
  }
  return out;
}

/**
 * How an edit of this spot is saved: `direct` for admins and for the owner of a spot under review or
 * rejected, `propose` (an edit an admin approves) for the owner of an approved spot, null otherwise.
 */
export function editRoute(spot: Pick<Spot, 'createdBy' | 'status'>, uid: string | undefined, isAdmin: boolean): 'direct' | 'propose' | null {
  if (isAdmin) return 'direct';
  if (!uid || spot.createdBy !== uid) return null;
  return spot.status === 'approved' ? 'propose' : 'direct';
}

export function isEmptyProposal(p: EditProposal): boolean {
  return Object.keys(p).length === 0;
}

/** One line of the admin's "what changed" view. */
export type DiffRow =
  | { kind: 'text'; field: 'name' | 'description'; before: string; after: string }
  | { kind: 'category'; before: string; after: string }
  | { kind: 'location'; before: { lat: number; lng: number }; after: { lat: number; lng: number } }
  | { kind: 'photosRemoved'; urls: string[] }
  | { kind: 'primaryPhoto'; before: string; after: string };

/** The changes a proposal makes to the spot as it is now, in display order. */
export function proposalDiff(spot: Spot, p: EditProposal): DiffRow[] {
  const rows: DiffRow[] = [];
  if (p.name !== undefined && p.name !== spot.name) rows.push({ kind: 'text', field: 'name', before: spot.name, after: p.name });
  if (p.description !== undefined && p.description !== (spot.description ?? '')) {
    rows.push({ kind: 'text', field: 'description', before: spot.description ?? '', after: p.description });
  }
  if (p.category !== undefined && p.category !== spot.category) rows.push({ kind: 'category', before: spot.category, after: p.category });
  if (p.location && !sameLocation(p.location, spot.location)) rows.push({ kind: 'location', before: spot.location, after: p.location });
  if (p.removeImageUrls?.length) rows.push({ kind: 'photosRemoved', urls: p.removeImageUrls });
  if (p.primaryImageUrl) rows.push({ kind: 'primaryPhoto', before: getThumbnailUrl(spot), after: p.primaryImageUrl });
  return rows;
}
