// Locked pins (growth plan §5, "give to get"), pure. Every pin stays on the map, but until the user
// has contributed, most places show only their category and distance. Switched by
// config/app.lockEnabled. A nudge, not protection: approved spots stay publicly readable.
import type { Spot } from '@/store/useSpotStore';

export interface LockContext {
  enabled: boolean;
  uid: string | null;
  /** Admins see everything (moderation). */
  isAdmin: boolean;
  /** The user added a spot (any status) or, outside the iOS app, someone joined with their invite. */
  contributed: boolean;
  following: ReadonlySet<string>;
  popular: ReadonlySet<string>;
  /** Opened from a link or a notice this session. */
  linked: ReadonlySet<string>;
}

/**
 * Whether the user has unlocked every place. The iOS app counts only an own spot (App Store 3.2.2:
 * no unlocking by inviting others); the web and Android also count a friend who joined.
 */
export function hasContributed(o: { ownSpots: number; invites: number; ios: boolean }): boolean {
  return o.ownSpots > 0 || (!o.ios && o.invites > 0);
}

export function isSpotLocked(spot: Pick<Spot, 'id' | 'status' | 'createdBy'>, ctx: LockContext): boolean {
  if (!ctx.enabled || ctx.isAdmin || ctx.contributed) return false;
  if (spot.status !== 'approved') return false;
  if (ctx.uid && spot.createdBy === ctx.uid) return false;
  return !ctx.following.has(spot.createdBy) && !ctx.popular.has(spot.id) && !ctx.linked.has(spot.id);
}
