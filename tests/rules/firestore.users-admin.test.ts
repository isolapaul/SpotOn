// Firestore rules for users, admins, categories and server-maintained collections (T12):
// client write paths from T11a + SEC-04/08/09/16 denials.
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import {
  addDoc, arrayRemove, arrayUnion, collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc,
  Timestamp, updateDoc, type Firestore,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { ADMIN, ALICE, BOB, SUPER, dbAs, seed, setupEnv } from './helpers';

const CAROL = 'carol'; // signed in, no users doc yet
let env: RulesTestEnvironment;

beforeAll(async () => { env = await setupEnv(); });
beforeEach(async () => { await env.clearFirestore(); await seed(env); });
afterAll(async () => { await env.cleanup(); });

const userRef = (db: Firestore, uid: string) => doc(db, 'users', uid);
const upd = (db: Firestore, uid: string, data: Record<string, unknown>) => updateDoc(userRef(db, uid), data);

/** Exactly T11a's createUserDoc payload (setDoc with merge). */
function newUserDoc(uid: string, over: Record<string, unknown> = {}) {
  return {
    uid, email: `${uid}@example.test`, photoURL: 'https://lh3.example.test/a.jpg',
    profilePictureURL: 'https://lh3.example.test/a.jpg', profileBannerURL: '', savedSpots: [],
    createdAt: serverTimestamp(), lastLoginAt: serverTimestamp(), ...over,
  };
}
const SETTINGS = { spotApproved: true, spotReviewed: false, newPendingSpot: true };
function pushPayload(withSettings: boolean) {
  return {
    fcmTokens: arrayUnion('tok3'), language: 'en', notificationsEnabled: true,
    lastTokenUpdate: new Date().toISOString(), ...(withSettings ? { notificationSettings: SETTINGS } : {}),
  };
}

describe('users: own document (T11a paths)', () => {
  it('allows creating the own doc with the new-user payload (and an empty email)', async () => {
    await assertSucceeds(setDoc(userRef(dbAs(env, CAROL), CAROL), newUserDoc(CAROL), { merge: true }));
    await env.clearFirestore();
    await assertSucceeds(setDoc(userRef(dbAs(env, CAROL), CAROL), newUserDoc(CAROL, { email: '' }), { merge: true }));
    await assertSucceeds(setDoc(userRef(dbAs(env, ALICE), ALICE), newUserDoc(ALICE), { merge: true })); // doc exists
  });
  it('allows get own doc and every T11a update payload', async () => {
    const db = dbAs(env, ALICE);
    await assertSucceeds(getDoc(userRef(db, ALICE)));
    await assertSucceeds(upd(db, ALICE, { lastLoginAt: serverTimestamp() }));
    await assertSucceeds(upd(db, ALICE, { savedSpots: arrayUnion('s2') }));
    await assertSucceeds(upd(db, ALICE, { savedSpots: arrayRemove('s1') }));
    await assertSucceeds(upd(db, ALICE, { profilePictureURL: 'https://x.test/p.jpg', photoURL: 'https://x.test/p.jpg' }));
    await assertSucceeds(upd(db, ALICE, { profileBannerURL: 'https://x.test/b.jpg' }));
    await assertSucceeds(upd(db, ALICE, pushPayload(true)));
    await assertSucceeds(upd(db, ALICE, pushPayload(false)));
    await assertSucceeds(upd(db, ALICE, { notificationsEnabled: false }));
    await assertSucceeds(upd(db, ALICE, { notificationSettings: { ...SETTINGS, newPendingSpot: false } }));
    await assertSucceeds(upd(db, ALICE, { fcmTokens: arrayRemove('tok1') }));
  });
  it('SEC-04: denies reading or listing other users and anonymous reads', async () => {
    await assertFails(getDoc(userRef(dbAs(env, BOB), ALICE)));
    await assertFails(getDoc(userRef(dbAs(env, ADMIN), ALICE)));
    await assertFails(getDocs(collection(dbAs(env, ALICE), 'users')));
    await assertFails(getDoc(userRef(dbAs(env, null), ALICE)));
  });
  it('SEC-04: denies creating, updating or deleting another user doc, and deleting own', async () => {
    await assertFails(setDoc(userRef(dbAs(env, ALICE), CAROL), newUserDoc(CAROL)));
    await assertFails(setDoc(userRef(dbAs(env, null), CAROL), newUserDoc(CAROL)));
    await assertFails(upd(dbAs(env, BOB), ALICE, { savedSpots: [] }));
    await assertFails(deleteDoc(userRef(dbAs(env, ALICE), ALICE)));
  });
  it('SEC-09: denies server-only fields on create and update', async () => {
    const serverOnly: Record<string, unknown> = {
      username: 'taken', customNameColor: 'red', customNameFont: 'font-bold', highlightedSpots: ['x'],
      spotsCount: 999, questRewards: { valentine2026: { highlightBonus: 99 } }, questProgress: { a: 1 },
    };
    for (const [k, v] of Object.entries(serverOnly)) {
      await assertFails(setDoc(userRef(dbAs(env, CAROL), CAROL), newUserDoc(CAROL, { [k]: v }), { merge: true }));
      await assertFails(upd(dbAs(env, ALICE), ALICE, { [k]: v }));
    }
  });
  it('denies invalid values (identity, language, settings, client clock, sizes)', async () => {
    const db = dbAs(env, ALICE);
    await assertFails(setDoc(userRef(dbAs(env, CAROL), CAROL), newUserDoc(CAROL, { uid: BOB })));
    await assertFails(setDoc(userRef(dbAs(env, CAROL), CAROL), newUserDoc(CAROL, { email: 'boss@example.test' })));
    await assertFails(setDoc(userRef(dbAs(env, CAROL), CAROL), newUserDoc(CAROL, { createdAt: Timestamp.now() })));
    await assertFails(upd(db, ALICE, { email: 'bob@example.test' }));
    await assertFails(upd(db, ALICE, { language: 'fr' }));
    await assertFails(upd(db, ALICE, { notificationSettings: { ...SETTINGS, marketing: true } }));
    await assertFails(upd(db, ALICE, { notificationSettings: { spotApproved: 'yes' } }));
    await assertFails(upd(db, ALICE, { notificationsEnabled: 'true' }));
    await assertFails(upd(db, ALICE, { lastLoginAt: Timestamp.now() }));
    await assertFails(upd(db, ALICE, { lastLoginAt: Timestamp.fromDate(new Date('2020-01-01T00:00:00Z')) }));
    await assertFails(upd(db, ALICE, { lastTokenUpdate: 'x'.repeat(65) }));
    await assertFails(upd(db, ALICE, { fcmTokens: Array.from({ length: 101 }, (_, i) => `t${i}`) }));
    await assertFails(upd(db, ALICE, { savedSpots: Array.from({ length: 1001 }, (_, i) => `s${i}`) }));
    await assertFails(upd(db, ALICE, { photoURL: 'x'.repeat(2049) }));
  });
  it('lets an over-cap legacy list shrink but not grow', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(userRef(ctx.firestore() as unknown as Firestore, ALICE), {
        fcmTokens: Array.from({ length: 150 }, (_, i) => `t${i}`),
        savedSpots: Array.from({ length: 1200 }, (_, i) => `s${i}`),
      });
    });
    const db = dbAs(env, ALICE);
    await assertSucceeds(upd(db, ALICE, { fcmTokens: arrayRemove('t1') }));
    await assertSucceeds(upd(db, ALICE, { savedSpots: arrayRemove('s1') }));
    await assertFails(upd(db, ALICE, { fcmTokens: arrayUnion('new') }));
    await assertFails(upd(db, ALICE, { savedSpots: arrayUnion('new') }));
    await assertFails(setDoc(userRef(dbAs(env, CAROL), CAROL), newUserDoc(CAROL, {
      savedSpots: Array.from({ length: 1001 }, (_, i) => `s${i}`),
    })));
  });
});

describe('admins', () => {
  it('allows get of own admin doc (existing or not) and admin list/get', async () => {
    await assertSucceeds(getDoc(doc(dbAs(env, ADMIN), 'admins', ADMIN)));
    await assertSucceeds(getDoc(doc(dbAs(env, SUPER), 'admins', SUPER)));
    await assertSucceeds(getDoc(doc(dbAs(env, ALICE), 'admins', ALICE))); // not an admin: doc missing
    await assertSucceeds(getDocs(collection(dbAs(env, ADMIN), 'admins')));
    await assertSucceeds(getDoc(doc(dbAs(env, ADMIN), 'admins', SUPER)));
  });
  it('SEC-08: denies client writes to admins, even by admins', async () => {
    await assertFails(setDoc(doc(dbAs(env, ALICE), 'admins', ALICE), { email: 'alice@example.test', role: 'super' }));
    await assertFails(updateDoc(doc(dbAs(env, ADMIN), 'admins', ADMIN), { role: 'super' }));
    await assertFails(setDoc(doc(dbAs(env, SUPER), 'admins', BOB), { email: 'bob@example.test' }));
    await assertFails(deleteDoc(doc(dbAs(env, SUPER), 'admins', ADMIN)));
  });
  it('SEC-08: denies non-admins listing admins or reading another admin doc', async () => {
    await assertFails(getDocs(collection(dbAs(env, ALICE), 'admins')));
    await assertFails(getDocs(collection(dbAs(env, null), 'admins')));
    await assertFails(getDoc(doc(dbAs(env, ALICE), 'admins', ADMIN)));
    await assertFails(getDoc(doc(dbAs(env, null), 'admins', ADMIN)));
  });
});

describe('categories', () => {
  const cat = () => ({ name: 'Beach', icon: '🏖️', createdAt: serverTimestamp() });
  it('anyone reads; an admin creates, updates and deletes', async () => {
    await assertSucceeds(getDocs(collection(dbAs(env, null), 'categories')));
    const db = dbAs(env, ADMIN);
    await assertSucceeds(addDoc(collection(db, 'categories'), cat()));
    await assertSucceeds(updateDoc(doc(db, 'categories', 'c1'), { name: 'Renamed' }));
    await assertSucceeds(deleteDoc(doc(db, 'categories', 'c1')));
  });
  it('SEC-08: denies non-admin writes and invalid admin creates', async () => {
    await assertFails(addDoc(collection(dbAs(env, ALICE), 'categories'), cat()));
    await assertFails(updateDoc(doc(dbAs(env, ALICE), 'categories', 'c1'), { name: 'x' }));
    await assertFails(deleteDoc(doc(dbAs(env, ALICE), 'categories', 'c1')));
    const db = dbAs(env, ADMIN);
    await assertFails(addDoc(collection(db, 'categories'), { ...cat(), extra: 1 }));
    await assertFails(addDoc(collection(db, 'categories'), { ...cat(), name: 'x'.repeat(51) }));
    await assertFails(addDoc(collection(db, 'categories'), { ...cat(), icon: '' }));
    await assertFails(addDoc(collection(db, 'categories'), { ...cat(), createdAt: Timestamp.now() }));
  });
});

describe('server-maintained and unknown collections', () => {
  it('anyone reads publicProfiles and usernames', async () => {
    await assertSucceeds(getDoc(doc(dbAs(env, null), 'publicProfiles', ALICE)));
    await assertSucceeds(getDoc(doc(dbAs(env, null), 'usernames', 'alice')));
    await assertSucceeds(getDoc(doc(dbAs(env, BOB), 'usernames', 'free_name')));
  });
  it('denies listing publicProfiles and usernames (no admin or username enumeration)', async () => {
    for (const uid of [null, BOB, ADMIN]) {
      await assertFails(getDocs(collection(dbAs(env, uid), 'publicProfiles')));
      await assertFails(getDocs(collection(dbAs(env, uid), 'usernames')));
    }
  });
  it('SEC-16: denies client writes to usernames and publicProfiles', async () => {
    const db = dbAs(env, BOB);
    await assertFails(setDoc(doc(db, 'usernames', 'bob'), { uid: BOB }));
    await assertFails(deleteDoc(doc(dbAs(env, ALICE), 'usernames', 'alice')));
    await assertFails(setDoc(doc(db, 'publicProfiles', BOB), { username: 'bob', spotsCount: 999 }));
    await assertFails(updateDoc(doc(dbAs(env, ALICE), 'publicProfiles', ALICE), { spotsCount: 999 }));
    await assertFails(setDoc(doc(dbAs(env, ADMIN), 'publicProfiles', ALICE), { username: 'x' }));
  });
  it('denies unknown and retired collections (favorites, reviews, notifications)', async () => {
    for (const name of ['favorites', 'reviews', 'notifications', 'foo']) {
      await assertFails(getDoc(doc(dbAs(env, ALICE), name, 'x')));
      await assertFails(getDocs(collection(dbAs(env, null), name)));
      await assertFails(setDoc(doc(dbAs(env, ALICE), name, 'x'), { userId: ALICE }));
    }
  });
});
