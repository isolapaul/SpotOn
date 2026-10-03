// Firestore rules for moderation (item 4): owner edits of spots under review or rejected, resubmit,
// edit proposals (spotEdits), photo submissions and the inbox.
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import {
  collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where,
  deleteField, type Firestore,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { ADMIN, ALICE, BOB, IMAGES, SPOT_APPROVED, SPOT_PENDING, T0, dbAs, seed, setupEnv, spotImage } from './helpers';

const { IMG1, IMG2 } = IMAGES;
const SPOT_REJECTED = 'rejectedSpot';
let env: RulesTestEnvironment;

beforeAll(async () => { env = await setupEnv(); });
beforeEach(async () => {
  await env.clearFirestore();
  await seed(env);
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore() as unknown as Firestore;
    await setDoc(doc(db, 'spots', SPOT_REJECTED), {
      name: 'Rejected', category: 'park', description: '', location: { lat: 47, lng: 19 },
      createdBy: ALICE, createdByName: 'alice', imageUrls: [IMG1, IMG2],
      spotImages: [spotImage('1_a', IMG1, ALICE), spotImage('2_b', IMG2, ALICE)], primaryImageIndex: 0,
      status: 'rejected', rejection: { reason: 'Blurry photos', at: T0 }, createdAt: T0, reviews: [],
    });
    await setDoc(doc(db, 'photoSubmissions', 'sub1'), { spotId: SPOT_APPROVED, uploader: BOB, url: IMG1, status: 'pending', createdAt: T0 });
    await setDoc(doc(db, 'users', ALICE, 'inbox', 'n1'), { type: 'spot_rejected', spotId: SPOT_REJECTED, spotName: 'Rejected', reason: 'x', read: false, createdAt: T0 });
  });
});
afterAll(async () => { await env.cleanup(); });

const upd = (db: Firestore, id: string, data: Record<string, unknown>) => updateDoc(doc(db, 'spots', id), data);

describe('owner edits of spots under review or rejected', () => {
  it('allows name, description, category, location, primary photo and photo removal', async () => {
    const db = dbAs(env, ALICE);
    for (const id of [SPOT_PENDING, SPOT_REJECTED]) {
      await assertSucceeds(upd(db, id, { name: 'Better name', description: 'd', category: 'viewpoint' }));
      await assertSucceeds(upd(db, id, { location: { lat: 47.2, lng: 19.3 }, primaryImageIndex: 1 }));
      await assertSucceeds(upd(db, id, { imageUrls: [IMG2], spotImages: [spotImage('2_b', IMG2, ALICE)], primaryImageIndex: 0 }));
    }
  });
  it('resubmits a rejected spot: pending, with the rejection removed together', async () => {
    const db = dbAs(env, ALICE);
    await assertFails(upd(db, SPOT_REJECTED, { status: 'pending' }));
    await assertFails(upd(db, SPOT_REJECTED, { rejection: deleteField() }));
    await assertSucceeds(upd(db, SPOT_REJECTED, { status: 'pending', rejection: deleteField(), name: 'Fixed' }));
  });
  it('denies self-approval, other status changes, invalid values and added photos', async () => {
    const db = dbAs(env, ALICE);
    await assertFails(upd(db, SPOT_PENDING, { status: 'approved' }));
    await assertFails(upd(db, SPOT_REJECTED, { status: 'approved', rejection: deleteField() }));
    await assertFails(upd(db, SPOT_PENDING, { status: 'rejected' }));
    await assertFails(upd(db, SPOT_PENDING, { category: 'nope' }));
    await assertFails(upd(db, SPOT_PENDING, { location: { lat: 91, lng: 0 } }));
    await assertFails(upd(db, SPOT_PENDING, { name: '' }));
    await assertFails(upd(db, SPOT_PENDING, { imageUrls: [IMG1, IMG2, 'https://evil.test/x.jpg'] }));
    await assertFails(upd(db, SPOT_PENDING, { createdBy: BOB }));
    await assertFails(upd(db, SPOT_PENDING, { primaryImageIndex: 2 }));
    await assertFails(upd(db, SPOT_REJECTED, { rejection: { reason: 'mine', at: T0 } }));
  });
  it('denies other users; the rejected spot is readable only by its owner and admins', async () => {
    await assertFails(upd(dbAs(env, BOB), SPOT_REJECTED, { name: 'x' }));
    await assertFails(upd(dbAs(env, BOB), SPOT_PENDING, { name: 'x' }));
    await assertFails(getDoc(doc(dbAs(env, BOB), 'spots', SPOT_REJECTED)));
    await assertSucceeds(getDoc(doc(dbAs(env, ALICE), 'spots', SPOT_REJECTED)));
    await assertSucceeds(getDoc(doc(dbAs(env, ADMIN), 'spots', SPOT_REJECTED)));
  });
});

describe('edit proposals (spotEdits)', () => {
  const proposal = (over: Record<string, unknown> = {}) => ({
    spotId: SPOT_APPROVED, spotName: 'Approved', ownerId: ALICE, status: 'pending',
    proposed: { name: 'Renamed', removeImageUrls: [IMG2] }, createdAt: serverTimestamp(), ...over,
  });
  const edit = (db: Firestore, id = SPOT_APPROVED) => doc(db, 'spotEdits', id);

  it('the owner of an approved spot proposes, replaces and withdraws an edit', async () => {
    const db = dbAs(env, ALICE);
    await assertSucceeds(setDoc(edit(db), proposal()));
    await assertSucceeds(setDoc(edit(db), proposal({ proposed: { description: 'new', category: 'park', location: { lat: 47, lng: 19 }, primaryImageUrl: IMG2 } })));
    await assertSucceeds(getDoc(edit(db)));
    await assertSucceeds(getDocs(query(collection(db, 'spotEdits'), where('ownerId', '==', ALICE))));
    await assertSucceeds(deleteDoc(edit(db)));
  });
  it('a new proposal replaces a rejected one', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore() as unknown as Firestore, 'spotEdits', SPOT_APPROVED),
        { ...proposal({ createdAt: T0 }), status: 'rejected', rejection: { reason: 'no', at: T0 } });
    });
    await assertSucceeds(setDoc(edit(dbAs(env, ALICE)), proposal()));
  });
  it('denies proposals for pending or foreign spots, other ids, statuses and fields', async () => {
    const alice = dbAs(env, ALICE);
    await assertFails(setDoc(edit(alice, SPOT_PENDING), proposal({ spotId: SPOT_PENDING })));
    await assertFails(setDoc(edit(dbAs(env, BOB)), proposal({ ownerId: BOB })));
    await assertFails(setDoc(edit(alice), proposal({ spotId: 'other' })));
    await assertFails(setDoc(edit(alice), proposal({ status: 'approved' })));
    await assertFails(setDoc(edit(alice), proposal({ createdAt: T0 })));
    await assertFails(setDoc(edit(alice), proposal({ proposed: {} })));
    await assertFails(setDoc(edit(alice), proposal({ proposed: { status: 'approved' } })));
    await assertFails(setDoc(edit(alice), proposal({ proposed: { category: 'nope' } })));
    await assertFails(setDoc(edit(alice), proposal({ rejection: { reason: 'x', at: T0 } })));
  });
  it('other users cannot read or list proposals; admins can', async () => {
    await setDoc(edit(dbAs(env, ALICE)), proposal());
    await assertFails(getDoc(edit(dbAs(env, BOB))));
    await assertFails(getDocs(collection(dbAs(env, BOB), 'spotEdits')));
    await assertFails(deleteDoc(edit(dbAs(env, BOB))));
    await assertSucceeds(getDocs(collection(dbAs(env, ADMIN), 'spotEdits')));
  });
});

describe('photo submissions', () => {
  it('the uploader and admins read them; nobody writes them', async () => {
    await assertSucceeds(getDoc(doc(dbAs(env, BOB), 'photoSubmissions', 'sub1')));
    await assertSucceeds(getDocs(query(collection(dbAs(env, BOB), 'photoSubmissions'), where('uploader', '==', BOB))));
    await assertSucceeds(getDocs(collection(dbAs(env, ADMIN), 'photoSubmissions')));
    await assertFails(getDoc(doc(dbAs(env, ALICE), 'photoSubmissions', 'sub1')));
    await assertFails(getDocs(collection(dbAs(env, ALICE), 'photoSubmissions')));
    await assertFails(setDoc(doc(dbAs(env, BOB), 'photoSubmissions', 'sub2'), { spotId: SPOT_APPROVED, uploader: BOB, url: IMG2 }));
    await assertFails(updateDoc(doc(dbAs(env, ADMIN), 'photoSubmissions', 'sub1'), { status: 'approved' }));
  });
});

describe('inbox', () => {
  const item = (db: Firestore) => doc(db, 'users', ALICE, 'inbox', 'n1');
  it('the owner reads, marks read and clears; nothing else', async () => {
    const db = dbAs(env, ALICE);
    await assertSucceeds(getDocs(collection(db, 'users', ALICE, 'inbox')));
    await assertSucceeds(updateDoc(item(db), { read: true }));
    await assertFails(updateDoc(item(db), { reason: 'changed' }));
    await assertFails(updateDoc(item(db), { read: 'yes' }));
    await assertFails(setDoc(doc(db, 'users', ALICE, 'inbox', 'n2'), { type: 'spot_approved' }));
    await assertSucceeds(deleteDoc(item(db)));
  });
  it('other users and admins cannot read it', async () => {
    await assertFails(getDocs(collection(dbAs(env, BOB), 'users', ALICE, 'inbox')));
    await assertFails(getDoc(item(dbAs(env, ADMIN))));
    await assertFails(getDoc(item(dbAs(env, null))));
  });
});
