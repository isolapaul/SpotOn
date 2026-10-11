// config/app (growth plan): public read, no client writes (the owner edits it in the console).
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, type Firestore } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { ALICE, SUPER, dbAs, seed, setupEnv } from './helpers';

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
