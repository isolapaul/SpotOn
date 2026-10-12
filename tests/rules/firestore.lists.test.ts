// Spot lists: users/{uid}/lists, owner-only; the profile shows shared ones through getProfile.
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { addDoc, arrayUnion, collection, collectionGroup, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where, type Firestore } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { ALICE, BOB, SPOT_APPROVED, T0, dbAs, seed, setupEnv } from './helpers';

let env: RulesTestEnvironment;
beforeAll(async () => { env = await setupEnv(); });
beforeEach(async () => {
  await env.clearFirestore();
  await seed(env);
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore() as unknown as Firestore;
    await setDoc(doc(db, 'users', ALICE, 'lists', 'l1'), { name: 'Sunsets', spotIds: [], shared: true, createdAt: T0, updatedAt: T0 });
  });
});
afterAll(async () => { await env.cleanup(); });

const list = (extra: Record<string, unknown> = {}) => ({
  name: 'Weekend', spotIds: [SPOT_APPROVED], shared: false, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), ...extra,
});

describe('lists', () => {
  it('only the owner reads them, even shared ones', async () => {
    await assertSucceeds(getDocs(collection(dbAs(env, ALICE), 'users', ALICE, 'lists')));
    await assertFails(getDocs(collection(dbAs(env, BOB), 'users', ALICE, 'lists')));
    await assertFails(getDoc(doc(dbAs(env, null), 'users', ALICE, 'lists', 'l1')));
  });
  it('the owner creates valid lists only', async () => {
    const col = (uid: string, owner = ALICE) => collection(dbAs(env, uid), 'users', owner, 'lists');
    await assertSucceeds(addDoc(col(ALICE), list()));
    await assertFails(addDoc(col(BOB), list()));
    await assertFails(addDoc(col(ALICE), list({ name: '   ' })));
    await assertFails(addDoc(col(ALICE), list({ name: 'x'.repeat(51) })));
    await assertFails(addDoc(col(ALICE), list({ name: 'x' + ' '.repeat(60) })));
    await assertFails(addDoc(col(ALICE), list({ spotIds: Array.from({ length: 201 }, (_, i) => `s${i}`) })));
    await assertFails(addDoc(col(ALICE), list({ shared: 'yes' })));
    await assertFails(addDoc(col(ALICE), list({ extra: 1 })));
    await assertFails(addDoc(col(ALICE), list({ createdAt: T0 })));
  });
  it('the owner edits (not createdAt) and deletes; others cannot', async () => {
    const ref = (uid: string) => doc(dbAs(env, uid), 'users', ALICE, 'lists', 'l1');
    await assertFails(updateDoc(ref(BOB), { spotIds: arrayUnion(SPOT_APPROVED), updatedAt: serverTimestamp() }));
    await assertFails(deleteDoc(ref(BOB)));
    await assertFails(updateDoc(ref(ALICE), { spotIds: arrayUnion(SPOT_APPROVED) }));
    await assertFails(updateDoc(ref(ALICE), { createdAt: serverTimestamp(), updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(ref(ALICE), { spotIds: arrayUnion(SPOT_APPROVED), shared: false, updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(ref(ALICE), { name: 'Golden hour', updatedAt: serverTimestamp() }));
    await assertSucceeds(deleteDoc(ref(ALICE)));
  });
});

describe('public lists (growth plan §7)', () => {
  const publicList = { name: 'Best Views', nameLower: 'best views', spotIds: [], shared: true, public: true, createdAt: T0, updatedAt: T0 };
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore() as unknown as Firestore, 'users', ALICE, 'lists', 'pub'), publicList);
    });
  });
  it('anyone reads a public list and finds it by a collection-group query', async () => {
    await assertSucceeds(getDoc(doc(dbAs(env, null), 'users', ALICE, 'lists', 'pub')));
    await assertSucceeds(getDoc(doc(dbAs(env, BOB), 'users', ALICE, 'lists', 'pub')));
    await assertSucceeds(getDocs(query(collectionGroup(dbAs(env, null), 'lists'), where('public', '==', true))));
    await assertFails(getDocs(collectionGroup(dbAs(env, null), 'lists')));
    // A shared (profile) list stays private.
    await assertFails(getDoc(doc(dbAs(env, BOB), 'users', ALICE, 'lists', 'l1')));
  });
  it('a public list must be on the profile and carry its search key', async () => {
    const ref = doc(dbAs(env, ALICE), 'users', ALICE, 'lists', 'l1');
    await assertSucceeds(updateDoc(ref, { public: true, nameLower: 'sunsets', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { shared: false, public: true, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { nameLower: 'something else', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(dbAs(env, BOB), 'users', ALICE, 'lists', 'pub'), { name: 'Hijacked', nameLower: 'hijacked', updatedAt: serverTimestamp() }));
  });
});
