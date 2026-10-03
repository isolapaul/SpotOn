// Replies to reviews: on approved spots, by their author; others read.
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { addDoc, collection, deleteDoc, doc, getDocs, serverTimestamp, setDoc, updateDoc, type Firestore } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { ALICE, BOB, SPOT_APPROVED, SPOT_PENDING, T0, dbAs, seed, setupEnv } from './helpers';

let env: RulesTestEnvironment;
beforeAll(async () => { env = await setupEnv(); });
beforeEach(async () => {
  await env.clearFirestore();
  await seed(env);
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore() as unknown as Firestore;
    await setDoc(doc(db, 'spots', SPOT_APPROVED, 'replies', 'r1'), { reviewId: 'x', userId: BOB, text: 'Is it open?', createdAt: T0 });
  });
});
afterAll(async () => { await env.cleanup(); });

const reply = (uid: string, extra: Record<string, unknown> = {}) => ({ reviewId: 'x', userId: uid, text: 'Yes, all day', createdAt: serverTimestamp(), ...extra });

describe('replies', () => {
  it('anyone reads replies of an approved spot', async () => {
    await assertSucceeds(getDocs(collection(dbAs(env, null), 'spots', SPOT_APPROVED, 'replies')));
    await assertFails(getDocs(collection(dbAs(env, BOB), 'spots', SPOT_PENDING, 'replies')));
  });
  it('a signed-in user replies as themself, 1-500 characters, on approved spots only', async () => {
    const db = dbAs(env, ALICE);
    await assertSucceeds(addDoc(collection(db, 'spots', SPOT_APPROVED, 'replies'), reply(ALICE)));
    await assertFails(addDoc(collection(db, 'spots', SPOT_APPROVED, 'replies'), reply(BOB)));
    await assertFails(addDoc(collection(db, 'spots', SPOT_APPROVED, 'replies'), reply(ALICE, { text: '  ' })));
    await assertFails(addDoc(collection(db, 'spots', SPOT_APPROVED, 'replies'), reply(ALICE, { text: 'x'.repeat(501) })));
    await assertFails(addDoc(collection(db, 'spots', SPOT_PENDING, 'replies'), reply(ALICE)));
    await assertFails(addDoc(collection(dbAs(env, null), 'spots', SPOT_APPROVED, 'replies'), reply(ALICE)));
  });
  it('only the author edits the text or deletes', async () => {
    const ref = (uid: string) => doc(dbAs(env, uid), 'spots', SPOT_APPROVED, 'replies', 'r1');
    await assertFails(updateDoc(ref(ALICE), { text: 'hijack', editedAt: serverTimestamp() }));
    await assertFails(deleteDoc(ref(ALICE)));
    await assertFails(updateDoc(ref(BOB), { userId: ALICE }));
    await assertSucceeds(updateDoc(ref(BOB), { text: 'Is it open at night?', editedAt: serverTimestamp() }));
    await assertSucceeds(deleteDoc(ref(BOB)));
  });
});
