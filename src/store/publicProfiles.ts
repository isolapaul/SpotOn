// Reads other users' public info from the server-maintained publicProfiles/{uid} mirror (T09/T11a).
// No cache: every call reads Firestore.
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface PublicProfile {
  username: string | null;
  profilePictureURL: string | null;
  customNameColor: string | null;
  customNameFont: string | null;
  spotsCount?: number;
  isAdmin?: boolean;
}

function strOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

export async function fetchPublicProfile(uid: string): Promise<PublicProfile | null> {
  const snap = await getDoc(doc(db, 'publicProfiles', uid));
  if (!snap.exists()) return null;
  const data = snap.data();
  const profile: PublicProfile = {
    username: strOrNull(data.username),
    profilePictureURL: strOrNull(data.profilePictureURL),
    customNameColor: strOrNull(data.customNameColor),
    customNameFont: strOrNull(data.customNameFont),
  };
  if (typeof data.spotsCount === 'number') profile.spotsCount = data.spotsCount;
  if (typeof data.isAdmin === 'boolean') profile.isAdmin = data.isAdmin;
  return profile;
}

export async function fetchPublicProfiles(uids: string[]): Promise<Record<string, PublicProfile | null>> {
  const unique = [...new Set(uids)];
  const profiles = await Promise.all(unique.map((uid) => fetchPublicProfile(uid)));
  return Object.fromEntries(unique.map((uid, i) => [uid, profiles[i]]));
}
