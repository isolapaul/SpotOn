// Reports (admins read) and blocks (the blocker reads); clients never write either.
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, query, setDoc, where, type Firestore } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { ADMIN, ALICE, BOB, T0, dbAs, seed, setupEnv } from './helpers';

let env: RulesTestEnvironment;
beforeAll(async () => { env = await setupEnv(); });
beforeEach(async () => {
  await env.clearFirestore();
  await seed(env);
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore() as unknown as Firestore;
    await setDoc(doc(db, 'reports', 'r1'), { reporter: ALICE, author: BOB, kind: 'profile', targetId: BOB, key: 'k', createdAt: T0 });
    await setDoc(doc(db, 'blocks', `${ALICE}_${BOB}`), { blocker: ALICE, blocked: BOB, createdAt: T0 });
    await setDoc(doc(db, 'spotLikes', `s1_${ALICE}`), { spotId: 's1', uid: ALICE, createdAt: T0 });
  });
});
afterAll(async () => { await env.cleanup(); });

describe('reports', () => {
  it('only admins read; nobody writes', async () => {
    await assertSucceeds(getDocs(collection(dbAs(env, ADMIN), 'reports')));
    for (const uid of [ALICE, BOB]) await assertFails(getDoc(doc(dbAs(env, uid), 'reports', 'r1')));
    await assertFails(setDoc(doc(dbAs(env, ALICE), 'reports', 'x'), { reporter: ALICE }));
    await assertFails(setDoc(doc(dbAs(env, ADMIN), 'reports', 'x'), { reporter: ADMIN }));
  });
});

describe('blocks', () => {
  it('the blocker reads their blocks; the blocked user does not; nobody writes', async () => {
    await assertSucceeds(getDocs(query(collection(dbAs(env, ALICE), 'blocks'), where('blocker', '==', ALICE))));
    await assertFails(getDoc(doc(dbAs(env, BOB), 'blocks', `${ALICE}_${BOB}`)));
    await assertFails(setDoc(doc(dbAs(env, BOB), 'blocks', `${BOB}_${ALICE}`), { blocker: BOB, blocked: ALICE }));
  });
});

describe('spot likes', () => {
  it('each liker reads only their own likes; who liked a spot is not listable; nobody writes', async () => {
    await assertSucceeds(getDocs(query(collection(dbAs(env, ALICE), 'spotLikes'), where('uid', '==', ALICE))));
    await assertSucceeds(getDoc(doc(dbAs(env, ALICE), 'spotLikes', `s1_${ALICE}`)));
    await assertFails(getDoc(doc(dbAs(env, BOB), 'spotLikes', `s1_${ALICE}`)));
    await assertFails(getDocs(query(collection(dbAs(env, BOB), 'spotLikes'), where('spotId', '==', 's1'))));
    await assertFails(getDoc(doc(dbAs(env, null), 'spotLikes', `s1_${ALICE}`)));
    await assertFails(setDoc(doc(dbAs(env, BOB), 'spotLikes', `s1_${BOB}`), { spotId: 's1', uid: BOB }));
    await assertFails(setDoc(doc(dbAs(env, ADMIN), 'spotLikes', `s1_${ADMIN}`), { spotId: 's1', uid: ADMIN }));
  });
});
