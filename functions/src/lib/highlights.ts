/**
 * Pure helpers for the unified highlight model (T10). No Firebase imports; `now` is injected.
 *
 * Source of truth for "active": the spots/{id}.highlighted[] entry by this user with
 * expiresAt > now. users.highlightedSpots and the legacy
 * users.questRewards.valentine2026.activeHighlights[] only nominate candidate spots.
 *
 * Stored shapes (must not change):
 * - spots.highlighted[]: {userId, highlightedAt: ISO string, expiresAt: ISO string}
 * - spots.isHighlighted: boolean
 * - users.highlightedSpots: string[]
 */
import {isValidSpotId} from "./ids";
import {maxHighlightsForCount} from "./levels";

/** A highlight lasts 7 days. */
export const HIGHLIGHT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Max candidate spots read per highlight request. */
export const MAX_HIGHLIGHT_CANDIDATES = 50;

export interface HighlightEntry {
  userId: string;
  highlightedAt: string;
  expiresAt: string;
}

/** Loose document shapes, as read from Firestore. */
export type DocData = Record<string, unknown>;

export interface CandidateSpot {
  id: string;
  /** undefined when the spot does not exist. */
  data: DocData | undefined;
}

export type HighlightErrorCode = "failed-precondition" | "permission-denied";

export interface HighlightError {
  code: HighlightErrorCode;
  message: string;
}

export interface HighlightPlan {
  spotUpdate: {highlighted: unknown[]; isHighlighted: true};
  userUpdate: {highlightedSpots: string[]};
  expiresAt: string;
}

export interface UnhighlightPlan {
  spotUpdate?: {highlighted: unknown[]; isHighlighted: boolean};
  userUpdate?: Record<string, unknown>;
}

function asRecord(x: unknown): Record<string, unknown> | undefined {
  return typeof x === "object" && x !== null && !Array.isArray(x) ?
    x as Record<string, unknown> : undefined;
}

function asArray(x: unknown): unknown[] {
  return Array.isArray(x) ? x : [];
}

/** Legacy questRewards.valentine2026 map, if any. */
function valentine(user: DocData | undefined): Record<string, unknown> | undefined {
  return asRecord(asRecord(user?.questRewards)?.valentine2026);
}

/** True for a highlighted[] entry by uid that has not expired at `now`. */
export function isActiveEntry(e: unknown, uid: string, now: Date): boolean {
  const entry = asRecord(e);
  return !!entry && entry.userId === uid && typeof entry.expiresAt === "string" &&
    Date.parse(entry.expiresAt) > now.getTime();
}

/** True when the spot's highlighted[] has an active entry by uid. */
export function hasActiveEntry(spot: DocData | undefined, uid: string, now: Date): boolean {
  return asArray(spot?.highlighted).some((e) => isActiveEntry(e, uid, now));
}

/** Level slots (maxHighlightsForCount) plus the Valentine highlightBonus (D9). */
export function computeAllowance(spotsCount: number, questRewards: unknown): number {
  const bonusRaw = asRecord(asRecord(questRewards)?.valentine2026)?.highlightBonus;
  const bonus = Math.max(0, Math.floor(Number(bonusRaw) || 0));
  return maxHighlightsForCount(spotsCount) + bonus;
}

/**
 * Candidate spot ids that may hold an active highlight by this user: unique strings from
 * users.highlightedSpots and the legacy activeHighlights[].spotId, excluding `spotId` and any id
 * that is not a valid spot id (isValidSpotId; such ids are pruned on the next highlight), at most
 * MAX_HIGHLIGHT_CANDIDATES.
 */
export function highlightCandidateIds(user: DocData | undefined, spotId: string): string[] {
  const legacy = asArray(valentine(user)?.activeHighlights)
    .map((h) => asRecord(h)?.spotId);
  const ids = [...asArray(user?.highlightedSpots), ...legacy]
    .filter((id): id is string => isValidSpotId(id) && id !== spotId);
  return [...new Set(ids)].slice(0, MAX_HIGHLIGHT_CANDIDATES);
}

/** Ids of candidate spots that exist and hold an active entry by uid. */
export function activeHighlightIds(
  candidateSpots: CandidateSpot[],
  uid: string,
  now: Date,
): string[] {
  return candidateSpots
    .filter((c) => c.data !== undefined && hasActiveEntry(c.data, uid, now))
    .map((c) => c.id);
}

/** Writes for highlighting `spotId`, or the first failing check (in the order below). */
export function planHighlight({uid, spotId, spot, candidateSpots, allowance, now}: {
  uid: string;
  spotId: string;
  spot: DocData;
  candidateSpots: CandidateSpot[];
  allowance: number;
  now: Date;
}): {plan: HighlightPlan} | {error: HighlightError} {
  const activeIds = activeHighlightIds(candidateSpots, uid, now)
    .filter((id) => id !== spotId);

  if (spot.status !== "approved") {
    return {error: {code: "failed-precondition", message: "Spot must be approved to highlight"}};
  }
  if (spot.createdBy !== uid) {
    return {error: {code: "permission-denied", message: "You can only highlight your own spots"}};
  }
  if (hasActiveEntry(spot, uid, now)) {
    return {error: {code: "permission-denied", message: "You have already highlighted this spot"}};
  }
  if (allowance === 0) {
    return {error: {code: "permission-denied", message: "No highlight bonus available"}};
  }
  if (activeIds.length >= allowance) {
    return {error: {code: "permission-denied", message: "You have reached your highlight limit"}};
  }

  const expiresAt = new Date(now.getTime() + HIGHLIGHT_TTL_MS).toISOString();
  const entry: HighlightEntry = {userId: uid, highlightedAt: now.toISOString(), expiresAt};
  return {
    plan: {
      spotUpdate: {
        highlighted: [
          ...asArray(spot.highlighted).filter((h) => asRecord(h)?.userId !== uid),
          entry,
        ],
        isHighlighted: true,
      },
      userUpdate: {highlightedSpots: [...activeIds, spotId]},
      expiresAt,
    },
  };
}

/**
 * Writes for removing uid's highlight of `spotId`. The spot is updated only if it held an entry
 * by uid; the user only if highlightedSpots or the legacy activeHighlights[] mention `spotId`.
 * A missing spot or user yields no write for that side.
 */
export function planUnhighlight({uid, spotId, spot, user}: {
  uid: string;
  spotId: string;
  spot: DocData | undefined;
  user: DocData | undefined;
}): UnhighlightPlan {
  const plan: UnhighlightPlan = {};

  if (spot) {
    const before = asArray(spot.highlighted);
    const highlighted = before.filter((h) => asRecord(h)?.userId !== uid);
    if (highlighted.length !== before.length) {
      plan.spotUpdate = {highlighted, isHighlighted: highlighted.length > 0};
    }
  }

  if (user) {
    const userUpdate: Record<string, unknown> = {};
    const spots = asArray(user.highlightedSpots);
    const keptSpots = spots.filter((id) => id !== spotId);
    if (keptSpots.length !== spots.length) {
      userUpdate.highlightedSpots = keptSpots;
    }
    const legacy = valentine(user)?.activeHighlights;
    if (Array.isArray(legacy)) {
      const keptLegacy = legacy.filter((h) => asRecord(h)?.spotId !== spotId);
      if (keptLegacy.length !== legacy.length) {
        userUpdate["questRewards.valentine2026.activeHighlights"] = keptLegacy;
      }
    }
    if (Object.keys(userUpdate).length) plan.userUpdate = userUpdate;
  }

  return plan;
}
