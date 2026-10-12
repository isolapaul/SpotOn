/**
 * Referral program (growth plan §2), pure. The code is the inviter's username; a new account
 * names its inviter once (claimReferral) within CLAIM_WINDOW_MS of signing up. XP (no money):
 * the invitee gets REFERRAL_XP.invitee, the inviter REFERRAL_XP.perInvite per invitee and
 * REFERRAL_XP.firstSpotBonus more once that invitee's first spot is approved.
 * KEEP IN SYNC with src/lib/referral.ts (badge thresholds).
 */
import {normalizeUsername} from "./profiles";

export const REFERRAL_XP = {invitee: 10, perInvite: 10, firstSpotBonus: 20} as const;

/** Badge thresholds (invitees): bronze, silver, gold "Ambassador". */
export const INVITE_BADGE_THRESHOLDS = [3, 5, 10] as const;

export const CLAIM_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** A typed code as a username key: trimmed, lowercased, without a leading @ or a link around it. */
export function normalizeInviteCode(x: unknown): string | null {
  if (typeof x !== "string") return null;
  let code = x.trim();
  const fromLink = /\/i\/([^/?#\s]+)/.exec(code);
  if (fromLink) {
    try {
      code = decodeURIComponent(fromLink[1]);
    } catch {
      return null;
    }
  }
  return normalizeUsername(code.replace(/^@/, ""));
}

/** Whether an account created at `createdMs` may still name its inviter at `now`. */
export function canClaimReferral(createdMs: number, now: number): boolean {
  return Number.isFinite(createdMs) && now - createdMs <= CLAIM_WINDOW_MS &&
    now >= createdMs - 60_000;
}

/** Referral XP: as an inviter (invitees, of whom with an approved spot) and as an invitee. */
export function referralXp(invites: number, invitesWithSpot: number, wasInvited: boolean): number {
  return invites * REFERRAL_XP.perInvite + invitesWithSpot * REFERRAL_XP.firstSpotBonus +
    (wasInvited ? REFERRAL_XP.invitee : 0);
}
