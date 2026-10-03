// Item 8: bio and privacy fields on users; follows and requests read by their two sides only.
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where, type Firestore } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { ALICE, BOB, T0, dbAs, seed, setupEnv } from './helpers';

let env: RulesTestEnvironment;
beforeAll(async () => { env = await setupEnv(); });
beforeEach(async () => {
  await env.clearFirestore();
  await seed(env);
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore() as unknown as Firestore;
    await setDoc(doc(db, 'follows', `${ALICE}_${BOB}`), { follower: ALICE, target: BOB, createdAt: T0 });
    await setDoc(doc(db, 'followRequests', `${BOB}_${ALICE}`), { requester: BOB, target: ALICE, createdAt: T0 });
  });
});
afterAll(async () => { await env.cleanup(); });

describe('profile fields', () => {
  it('the owner sets a bio up to 150 characters, privacy and saved-spot visibility', async () => {
    const db = dbAs(env, ALICE);
    await assertSucceeds(updateDoc(doc(db, 'users', ALICE), { bio: 'x'.repeat(150), profilePrivate: true, showSaved: false }));
    await assertSucceeds(updateDoc(doc(db, 'users', ALICE), { bio: '', notificationSettings: { follows: false } }));
    await assertFails(updateDoc(doc(db, 'users', ALICE), { bio: 'x'.repeat(151) }));
    await assertFails(updateDoc(doc(db, 'users', ALICE), { profilePrivate: 'yes' }));
    await assertFails(updateDoc(doc(dbAs(env, BOB), 'users', ALICE), { bio: 'hi' }));
  });
});

describe('follows and requests', () => {
  it('each side reads its own; nobody else, and nobody writes', async () => {
    for (const uid of [ALICE, BOB]) {
      await assertSucceeds(getDoc(doc(dbAs(env, uid), 'follows', `${ALICE}_${BOB}`)));
      await assertSucceeds(getDoc(doc(dbAs(env, uid), 'followRequests', `${BOB}_${ALICE}`)));
    }
    await assertSucceeds(getDocs(query(collection(dbAs(env, ALICE), 'followRequests'), where('target', '==', ALICE))));
    await assertFails(getDocs(collection(dbAs(env, ALICE), 'follows')));
    await assertFails(getDoc(doc(dbAs(env, 'carol'), 'follows', `${ALICE}_${BOB}`)));
    await assertFails(getDoc(doc(dbAs(env, null), 'followRequests', `${BOB}_${ALICE}`)));
    await assertFails(setDoc(doc(dbAs(env, ALICE), 'follows', `${ALICE}_x`), { follower: ALICE, target: 'x', createdAt: T0 }));
    await assertFails(deleteDoc(doc(dbAs(env, ALICE), 'follows', `${ALICE}_${BOB}`)));
    await assertFails(deleteDoc(doc(dbAs(env, ALICE), 'followRequests', `${BOB}_${ALICE}`)));
    await assertFails(getDoc(doc(dbAs(env, ALICE), 'rateLimits', ALICE)));
  });
});
