/**
 * Where tapping a push opens the app (pure): follow news open the other user's profile
 * (/user/<uid>), spot news the spot (/spot/<id>); removals open the app's start page.
 */
export type LinkedNotice = {type: string; spotId: string; actorUid?: string};

const PROFILE_TYPES = ["follow_request", "follow_accepted", "new_follower"];
const NO_SPOT_TYPES = ["spot_removed", "content_removed"];

export function inboxLinkPath(n: LinkedNotice): string {
  if (PROFILE_TYPES.includes(n.type)) return n.actorUid ? `/user/${encodeURIComponent(n.actorUid)}` : "";
  if (n.spotId && !NO_SPOT_TYPES.includes(n.type)) return `/spot/${encodeURIComponent(n.spotId)}`;
  return "";
}

/** The click link of a push: the app URL plus the notice's path (FCM needs an HTTPS link). */
export function pushLink(appUrl: string, path: string | undefined): string | null {
  if (!appUrl.startsWith("https://")) return null;
  const base = appUrl.replace(/\/$/, "");
  return path && path.startsWith("/") && !path.startsWith("//") ? base + path : base;
}
