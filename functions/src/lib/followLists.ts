/**
 * The people rows of a followers / following list (getFollowList) and of the people search: the
 * public profile fields the app shows. Pure.
 */
import {DocumentData} from "firebase-admin/firestore";

export interface ListedPerson {
  uid: string;
  username: string;
  profilePictureURL: string | null;
  level: number | null;
  isPrivate: boolean;
}

/** Existing public profiles with a username, in the given order. */
export function listedPeople(
  profiles: ReadonlyArray<{id: string; exists: boolean; data: DocumentData | undefined}>,
): ListedPerson[] {
  return profiles.flatMap((p) => {
    const d = p.data;
    if (!p.exists || !d || typeof d.username !== "string" || !d.username) return [];
    return [{
      uid: p.id,
      username: d.username,
      profilePictureURL: typeof d.profilePictureURL === "string" ? d.profilePictureURL : null,
      level: typeof d.level === "number" ? d.level : null,
      isPrivate: d.isPrivate === true,
    }];
  });
}
