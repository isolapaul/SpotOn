// Referral program (growth plan §2), pure. The invite code is the inviter's username; the link is
// SITE_URL/i/<username>. KEEP IN SYNC with functions/src/lib/referrals.ts.

/** The progress steps shown on the invite sheet; badges start at the second. */
export const INVITE_STEPS = [1, 3, 5, 10] as const;

export type InviteBadgeTier = 'bronze' | 'silver' | 'gold';

/** Badge thresholds (invitees). */
export const INVITE_BADGES: ReadonlyArray<{ tier: InviteBadgeTier; min: number }> = [
  { tier: 'gold', min: 10 },
  { tier: 'silver', min: 5 },
  { tier: 'bronze', min: 3 },
];

/** XP per referral event (shown on the invite sheet). */
export const REFERRAL_XP = { invitee: 10, perInvite: 10, firstSpotBonus: 20 } as const;

/** The days a new account has to name its inviter. */
export const INVITE_CLAIM_DAYS = 7;

/** The badge for an invitee count, else null. */
export function inviteBadge(count: number): InviteBadgeTier | null {
  return INVITE_BADGES.find((b) => count >= b.min)?.tier ?? null;
}

/** The next step not reached yet (null when all are). */
export function nextInviteStep(count: number): number | null {
  return INVITE_STEPS.find((s) => s > count) ?? null;
}

export function inviteLink(siteUrl: string, username: string): string {
  return `${siteUrl.replace(/\/$/, '')}/i/${encodeURIComponent(username)}`;
}

const USERNAME = /^[a-z0-9_]{3,20}$/;

/** A typed code (username, @name or an invite link) as a username, else null. */
export function normalizeInviteCode(x: string): string | null {
  let code = x.trim();
  const fromLink = /\/i\/([^/?#\s]+)/.exec(code);
  if (fromLink) {
    try {
      code = decodeURIComponent(fromLink[1]);
    } catch {
      return null;
    }
  }
  code = code.replace(/^@/, '').toLowerCase();
  return USERNAME.test(code) ? code : null;
}

/** The code of an in-app invite path ("/i/anna"), else null. */
export function invitePathCode(path: string): string | null {
  const match = /^\/i\/([^/?#]+)\/?(?:[?#].*)?$/.exec(path);
  return match ? normalizeInviteCode(`/i/${match[1]}`) : null;
}

/** Whether an account created at `createdMs` may still name its inviter. */
export function canStillClaim(createdMs: number | undefined, now: number): boolean {
  return createdMs !== undefined && now - createdMs <= INVITE_CLAIM_DAYS * 24 * 60 * 60 * 1000;
}
