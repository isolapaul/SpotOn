// Growth plan collections: config/app (public read, console-edited), telemetry, referrals.
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where, type Firestore } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { ALICE, BOB, SUPER, dbAs, seed, setupEnv } from './helpers';

let env: RulesTestEnvironment;
beforeAll(async () => { env = await setupEnv(); });
beforeEach(async () => {
  await env.clearFirestore();
  await seed(env);
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore() as unknown as Firestore, 'config', 'app'), { lockEnabled: false });
  });
});
afterAll(async () => { await env.cleanup(); });

describe('config', () => {
  it('anyone reads it', async () => {
    await assertSucceeds(getDoc(doc(dbAs(env, null), 'config', 'app')));
    await assertSucceeds(getDoc(doc(dbAs(env, ALICE), 'config', 'app')));
  });
  it('nobody writes it from a client, the super admin included', async () => {
    await assertFails(setDoc(doc(dbAs(env, ALICE), 'config', 'app'), { lockEnabled: true }));
    await assertFails(setDoc(doc(dbAs(env, SUPER), 'config', 'app'), { lockEnabled: true }));
  });
});

describe('telemetry', () => {
  it('only the super admin reads stats and client errors; nobody writes them', async () => {
    for (const col of ['stats', 'clientErrors']) {
      await assertSucceeds(getDoc(doc(dbAs(env, SUPER), col, 'x')));
      await assertFails(getDoc(doc(dbAs(env, ALICE), col, 'x')));
      await assertFails(getDoc(doc(dbAs(env, null), col, 'x')));
      await assertFails(setDoc(doc(dbAs(env, SUPER), col, 'x'), { a: 1 }));
    }
  });
});

describe('referrals', () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore() as unknown as Firestore, 'referrals', BOB), { referrer: ALICE, invitee: BOB, spotApproved: false });
    });
  });
  it('the inviter and the invitee read it, nobody else; nobody writes', async () => {
    await assertSucceeds(getDoc(doc(dbAs(env, ALICE), 'referrals', BOB)));
    await assertSucceeds(getDoc(doc(dbAs(env, BOB), 'referrals', BOB)));
    await assertFails(getDoc(doc(dbAs(env, SUPER), 'referrals', BOB)));
    await assertFails(getDoc(doc(dbAs(env, null), 'referrals', BOB)));
    await assertSucceeds(getDocs(query(collection(dbAs(env, ALICE), 'referrals'), where('referrer', '==', ALICE))));
    await assertFails(getDocs(collection(dbAs(env, ALICE), 'referrals')));
    await assertFails(setDoc(doc(dbAs(env, BOB), 'referrals', BOB), { referrer: ALICE, invitee: BOB, spotApproved: true }));
  });
  it('the user cannot write referredBy', async () => {
    await assertFails(updateDoc(doc(dbAs(env, BOB), 'users', BOB), { referredBy: ALICE }));
  });
});

describe('views and visits', () => {
  it('anyone reads a spot\'s counters; the marks and owner stats are server-only', async () => {
    await assertSucceeds(getDoc(doc(dbAs(env, null), 'spotStats', 'x')));
    await assertFails(setDoc(doc(dbAs(env, SUPER), 'spotStats', 'x'), { viewCount: 9 }));
    await assertFails(getDoc(doc(dbAs(env, ALICE), 'viewMarks', 'x_alice')));
    await assertFails(getDoc(doc(dbAs(env, ALICE), 'ownerStats', ALICE)));
  });
  it('admins cannot write the rolled-up counters on a spot', async () => {
    await assertFails(updateDoc(doc(dbAs(env, SUPER), 'spots', 'approvedSpot'), { viewCount: 100 }));
    await assertFails(updateDoc(doc(dbAs(env, SUPER), 'spots', 'approvedSpot'), { visitCount: 100 }));
    await assertSucceeds(updateDoc(doc(dbAs(env, SUPER), 'spots', 'approvedSpot'), { description: 'edited by an admin' }));
  });
});
