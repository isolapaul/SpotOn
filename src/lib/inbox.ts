// The in-app inbox (item 4): users/{uid}/inbox, written by Cloud Functions. Items carry a type and
// the spot's name (plus the admin's reason), and are translated on the device. Pure.
import type { TranslationKey } from './translations';

export type InboxType =
  | 'spot_approved'
  | 'spot_rejected'
  | 'spot_removed'
  | 'edit_approved'
  | 'edit_rejected'
  | 'photo_approved'
  | 'photo_rejected'
  | 'follow_request'
  | 'follow_accepted'
  | 'followed_spot';

export interface InboxItem {
  id: string;
  type: InboxType;
  spotId: string;
  spotName: string;
  reason?: string;
  /** The other user of a follow notice (item 8). */
  actorUid?: string;
  actorName?: string;
  read: boolean;
  /** ms since epoch; a pending server timestamp reads as now. */
  createdAt: number;
}

/** Title and body per type; bodies take {name} and, for decisions against, {reason}. */
export const INBOX_TEXT: Readonly<Record<InboxType, { title: TranslationKey; body: TranslationKey }>> = {
  spot_approved: { title: 'inboxSpotApproved', body: 'inboxSpotApprovedBody' },
  spot_rejected: { title: 'inboxSpotRejected', body: 'inboxSpotRejectedBody' },
  spot_removed: { title: 'inboxSpotRemoved', body: 'inboxReasonBody' },
  edit_approved: { title: 'inboxEditApproved', body: 'inboxEditApprovedBody' },
  edit_rejected: { title: 'inboxEditRejected', body: 'inboxReasonBody' },
  photo_approved: { title: 'inboxPhotoApproved', body: 'inboxPhotoApprovedBody' },
  photo_rejected: { title: 'inboxPhotoRejected', body: 'inboxReasonBody' },
  follow_request: { title: 'inboxFollowRequest', body: 'inboxFollowRequestBody' },
  follow_accepted: { title: 'inboxFollowAccepted', body: 'inboxFollowAcceptedBody' },
  followed_spot: { title: 'inboxFollowedSpot', body: 'inboxFollowedSpotBody' },
};

/** Decisions in the user's favour (a positive look in the notification centre). */
export function isApproval(type: InboxType): boolean {
  return type === 'spot_approved' || type === 'edit_approved' || type === 'photo_approved'
    || type === 'follow_request' || type === 'follow_accepted' || type === 'followed_spot';
}

function isInboxType(x: unknown): x is InboxType {
  return typeof x === 'string' && Object.hasOwn(INBOX_TEXT, x);
}

/** An inbox document as an item, or null for an unknown or malformed one. */
export function parseInboxItem(id: string, data: Record<string, unknown>, now: number): InboxItem | null {
  if (!isInboxType(data.type)) return null;
  const at = data.createdAt as { toMillis?: () => number } | null | undefined;
  return {
    id,
    type: data.type,
    spotId: typeof data.spotId === 'string' ? data.spotId : '',
    spotName: typeof data.spotName === 'string' ? data.spotName : '',
    ...(typeof data.reason === 'string' ? { reason: data.reason } : {}),
    ...(typeof data.actorUid === 'string' ? { actorUid: data.actorUid, actorName: typeof data.actorName === 'string' ? data.actorName : '' } : {}),
    read: data.read === true,
    createdAt: typeof at?.toMillis === 'function' ? at.toMillis() : now,
  };
}
