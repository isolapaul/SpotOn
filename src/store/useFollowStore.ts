import { create } from 'zustand';
import { collection, onSnapshot, query, where, type Unsubscribe } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/lib/firebase';
import { invalidatePublicProfile } from './publicProfiles';

/** Where the signed-in user stands with someone (item 8). */
export type FollowState = 'none' | 'requested' | 'following';

/** What a visitor may see of a profile (the getProfile callable). */
export interface ProfileView {
  canView: boolean;
  relation: FollowState;
  followsYou: boolean;
  spotIds?: string[];
  savedSpotIds?: string[];
}

export interface PersonResult {
  uid: string;
  username: string;
  profilePictureURL: string | null;
  level: number | null;
  isPrivate: boolean;
}

const call = <I, O>(name: string) => httpsCallable<I, O>(functions, name);
const getProfileCallable = call<{ uid: string }, ProfileView>('getProfile');
const followCallable = call<{ uid: string }, { state: FollowState }>('followUser');
const unfollowCallable = call<{ uid: string }, { state: FollowState }>('unfollowUser');
const respondCallable = call<{ uid: string; accept: boolean }, { accepted: boolean }>('respondFollowRequest');
const removeFollowerCallable = call<{ uid: string }, unknown>('removeFollower');
const searchUsersCallable = call<{ q: string }, { results: PersonResult[] }>('searchUsers');

interface FollowStore {
  /** Follow requests to the signed-in user, oldest first (a live listener). */
  requests: { requester: string; createdAt: number }[];
  sync: (uid: string | null) => void;
  getProfile: (uid: string) => Promise<ProfileView>;
  follow: (me: string, uid: string) => Promise<FollowState>;
  unfollow: (me: string, uid: string) => Promise<FollowState>;
  respond: (me: string, requester: string, accept: boolean) => Promise<void>;
  removeFollower: (me: string, uid: string) => Promise<void>;
  searchPeople: (q: string) => Promise<PersonResult[]>;
}

let listening: { uid: string; unsubscribe: Unsubscribe } | null = null;

/** Both profiles' counters changed: their next read must hit Firestore. */
function invalidate(a: string, b: string) {
  invalidatePublicProfile(a);
  invalidatePublicProfile(b);
}

/**
 * Follows (item 8): every change goes through the callables, which keep the counters; the
 * signed-in user's incoming requests are listened to live (the notification centre shows them).
 */
export const useFollowStore = create<FollowStore>((set) => ({
  requests: [],
  sync: (uid) => {
    if (listening?.uid === uid) return;
    listening?.unsubscribe();
    listening = null;
    set({ requests: [] });
    if (!uid) return;
    const unsubscribe = onSnapshot(
      query(collection(db, 'followRequests'), where('target', '==', uid)),
      (snap) => {
        const requests = snap.docs
          .map((d) => {
            const at = d.get('createdAt') as { toMillis?: () => number } | null;
            return { requester: String(d.get('requester') ?? ''), createdAt: at?.toMillis?.() ?? Date.now() };
          })
          .filter((r) => r.requester)
          .sort((a, b) => a.createdAt - b.createdAt);
        set({ requests });
      },
      (error) => console.error('Follow requests listener failed:', error),
    );
    listening = { uid, unsubscribe };
  },
  getProfile: async (uid) => (await getProfileCallable({ uid })).data,
  follow: async (me, uid) => {
    const { state } = (await followCallable({ uid })).data;
    invalidate(me, uid);
    return state;
  },
  unfollow: async (me, uid) => {
    await unfollowCallable({ uid });
    invalidate(me, uid);
    return 'none';
  },
  respond: async (me, requester, accept) => {
    await respondCallable({ uid: requester, accept });
    invalidate(me, requester);
  },
  removeFollower: async (me, uid) => {
    await removeFollowerCallable({ uid });
    invalidate(me, uid);
  },
  searchPeople: async (q) => (await searchUsersCallable({ q })).data.results,
}));
