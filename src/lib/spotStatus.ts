// Spot status → badge class / translation key (T27, moved from ProfilePanel's
// getStatusClassName / getStatusText). Pure; any unknown status renders as `rejected`.
import type { TranslationKey } from './translations';

type KnownSpotStatus = 'approved' | 'pending' | 'rejected';

export const STATUS_CLASS: Readonly<Record<KnownSpotStatus, string>> = {
  approved: 'bg-green-500/20 text-green-400',
  pending: 'bg-yellow-500/20 text-yellow-400',
  rejected: 'bg-red-500/20 text-red-400',
};

export const STATUS_LABEL_KEY: Readonly<Record<KnownSpotStatus, TranslationKey>> = {
  approved: 'approved',
  pending: 'pending',
  rejected: 'rejected',
};

function knownStatus(status: string): KnownSpotStatus {
  return Object.hasOwn(STATUS_CLASS, status) ? (status as KnownSpotStatus) : 'rejected';
}

/** Badge classes for a spot status (unknown → rejected). */
export function statusClass(status: string): string {
  return STATUS_CLASS[knownStatus(status)];
}

/** Translation key for a spot status (unknown → rejected). */
export function statusLabelKey(status: string): TranslationKey {
  return STATUS_LABEL_KEY[knownStatus(status)];
}

/**
 * Whether a spot is shown on the map: admins see every spot, everyone else the approved ones and
 * their own (any status; non-approved markers are yellow). Other users' pending spots never reach
 * a non-admin client anyway (T30 rules); the filter keeps the map correct while scopes switch.
 */
export function isVisibleOnMap(
  spot: { status: string; createdBy?: string },
  uid: string | null | undefined,
  isAdmin: boolean,
): boolean {
  return isAdmin || spot.status === 'approved' || (!!uid && spot.createdBy === uid);
}
