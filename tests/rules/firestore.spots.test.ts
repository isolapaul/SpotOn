// Firestore rules for spots (T12): client write paths from T11b + SEC-02/03/05/09/10 denials.
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import {
  addDoc, arrayUnion, collection, deleteDoc, doc, getDoc, getDocs, orderBy, query, serverTimestamp,
  Timestamp, updateDoc, where, type Firestore,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  ADMIN, ALICE, BOB, IMAGES, PLACEHOLDER, SPOT_APPROVED, SPOT_LEGACY, SPOT_NO_REVIEWS, SPOT_PENDING,
  dbAs, review, seed, setupEnv, spotImage,
} from './helpers';

const { IMG1, IMG2 } = IMAGES;
let env: RulesTestEnvironment;

beforeAll(async () => { env = await setupEnv(); });
beforeEach(async () => { await env.clearFirestore(); await seed(env); });
afterAll(async () => { await env.cleanup(); });

function newSpot(uid: string, over: Record<string, unknown> = {}) {
  return {
    name: 'New spot', category: 'viewpoint', description: 'nice', location: { lat: 47.1, lng: 19.2 },
    createdBy: uid, createdByName: uid, createdByPhoto: '',
    imageUrls: [IMG1], spotImages: [spotImage('9_x', IMG1, uid)], primaryImageIndex: 0,
    status: 'pending', createdAt: serverTimestamp(), ...over,
  };
}
const create = (db: Firestore, data: Record<string, unknown>) => addDoc(collection(db, 'spots'), data);
const upd = (db: Firestore, id: string, data: Record<string, unknown>) => updateDoc(doc(db, 'spots', id), data);

function newReview(uid: string, over: Record<string, unknown> = {}) {
  return { id: `${uid}_${Date.now()}`, userId: uid, userName: uid, userPhoto: 'https://x.test/p.jpg',
    rating: 4, comment: 'great', createdAt: Timestamp.now(), ...over };
}
const append = (db: Firestore, id: string, r: Record<string, unknown>) => upd(db, id, { reviews: arrayUnion(r) });
function without(obj: Record<string, unknown>, key: string) {
  const copy = { ...obj };
  delete copy[key];
  return copy;
}

describe('reads', () => {
  it('anyone reads spots (list ordered by createdAt, and get), incl. pending', async () => {
    const anon = dbAs(env, null);
    await assertSucceeds(getDocs(query(collection(anon, 'spots'), orderBy('createdAt', 'desc'))));
    await assertSucceeds(getDoc(doc(anon, 'spots', SPOT_PENDING)));
  });
  it('owner queries own spots (createdBy == me)', async () => {
    await assertSucceeds(getDocs(query(collection(dbAs(env, ALICE), 'spots'), where('createdBy', '==', ALICE))));
  });
});

describe('create (addSpot)', () => {
  it('allows a pending spot with images, placeholder only, or without createdByPhoto', async () => {
    const db = dbAs(env, ALICE);
    await assertSucceeds(create(db, newSpot(ALICE)));
    await assertSucceeds(create(db, newSpot(ALICE, {
      imageUrls: [PLACEHOLDER], spotImages: [spotImage('1_placeholder', PLACEHOLDER, ALICE)],
    })));
    await assertSucceeds(create(db, without(newSpot(ALICE), 'createdByPhoto')));
    await assertSucceeds(create(db, newSpot(ALICE, { imageUrls: Array(20).fill(IMG1), primaryImageIndex: 19 })));
  });
  it('allows an admin to create an approved spot', async () => {
    await assertSucceeds(create(dbAs(env, ADMIN), newSpot(ADMIN, { status: 'approved' })));
  });
  it('SEC-02: denies self-approval, foreign createdBy, extra keys and client createdAt', async () => {
    const db = dbAs(env, ALICE);
    await assertFails(create(db, newSpot(ALICE, { status: 'approved' })));
    await assertFails(create(db, newSpot(ALICE, { status: 'rejected' })));
    await assertFails(create(db, newSpot(BOB)));
    for (const extra of ['reviews', 'highlighted', 'isHighlighted', 'foo']) {
      await assertFails(create(db, newSpot(ALICE, { [extra]: [] })));
    }
    await assertFails(create(db, newSpot(ALICE, { createdAt: Timestamp.now() })));
    await assertFails(create(db, without(newSpot(ALICE), 'createdAt')));
  });
  it('SEC-02: denies invalid images, index, category, location, name and unauthenticated create', async () => {
    const db = dbAs(env, ALICE);
    await assertFails(create(db, newSpot(ALICE, { imageUrls: Array(21).fill(IMG1) })));
    await assertFails(create(db, newSpot(ALICE, { imageUrls: [] })));
    await assertFails(create(db, newSpot(ALICE, { spotImages: Array(21).fill(spotImage('1', IMG1, ALICE)) })));
    await assertFails(create(db, newSpot(ALICE, { primaryImageIndex: 1 })));
    await assertFails(create(db, newSpot(ALICE, { primaryImageIndex: -1 })));
    await assertFails(create(db, newSpot(ALICE, { category: 'nightclub' })));
    await assertFails(create(db, newSpot(ALICE, { location: { lat: 91, lng: 0 } })));
    await assertFails(create(db, newSpot(ALICE, { location: { lat: 1, lng: 2, alt: 3 } })));
    await assertFails(create(db, newSpot(ALICE, { location: { lat: '1', lng: 2 } })));
    await assertFails(create(db, newSpot(ALICE, { name: '' })));
    await assertFails(create(db, newSpot(ALICE, { name: 'x'.repeat(101) })));
    await assertFails(create(db, newSpot(ALICE, { description: 'x'.repeat(2001) })));
    await assertFails(create(dbAs(env, null), newSpot(ALICE)));
  });
});

describe('reviews (addReview append)', () => {
  it('allows appending to a spot with reviews, without reviews field, and to the legacy spot', async () => {
    const db = dbAs(env, ALICE);
    await assertSucceeds(append(db, SPOT_APPROVED, newReview(ALICE)));
    await assertSucceeds(append(db, SPOT_NO_REVIEWS, newReview(ALICE)));
    await assertSucceeds(append(db, SPOT_LEGACY, newReview(ALICE)));
    await assertSucceeds(append(db, SPOT_PENDING, newReview(ALICE)));
  });
  it('allows with and without userPhoto, rating 1 and 5, a 1000-char comment', async () => {
    const db = dbAs(env, BOB);
    await assertSucceeds(append(db, SPOT_NO_REVIEWS, without(newReview(BOB, { rating: 1 }), 'userPhoto')));
    await assertSucceeds(append(db, SPOT_NO_REVIEWS, newReview(BOB, { id: `${BOB}_2`, rating: 5, comment: 'x'.repeat(1000) })));
  });
  it('SEC-03/05: denies PII and self-asserted badge fields', async () => {
    const db = dbAs(env, ALICE);
    for (const [k, v] of [['userEmail', 'alice@example.test'], ['userSpotsCount', 999],
      ['customNameColor', 'red'], ['customNameFont', 'fixed inset-0']] as const) {
      await assertFails(append(db, SPOT_APPROVED, newReview(ALICE, { [k]: v })));
    }
  });
  it('SEC-05: denies foreign userId, bad id, bad ratings, long comment, missing/future createdAt', async () => {
    const db = dbAs(env, ALICE);
    await assertFails(append(db, SPOT_APPROVED, newReview(ALICE, { userId: BOB })));
    await assertFails(append(db, SPOT_APPROVED, newReview(ALICE, { id: `${BOB}_1` })));
    await assertFails(append(db, SPOT_APPROVED, newReview(ALICE, { id: 'whatever' })));
    for (const rating of [0, 6, 4.5, '5']) {
      await assertFails(append(db, SPOT_APPROVED, newReview(ALICE, { rating })));
    }
    await assertFails(append(db, SPOT_APPROVED, newReview(ALICE, { comment: 'x'.repeat(1001) })));
    await assertFails(append(db, SPOT_APPROVED, without(newReview(ALICE), 'createdAt')));
    await assertFails(append(db, SPOT_APPROVED, newReview(ALICE, { createdAt: Timestamp.fromMillis(Date.now() + 3_600_000) })));
    await assertFails(append(db, SPOT_APPROVED, newReview(ALICE, { userName: '' })));
  });
  it('SEC-03/05: denies modifying, deleting, reordering existing reviews and appending two', async () => {
    const db = dbAs(env, ALICE);
    const old = review(BOB);
    await assertFails(upd(db, SPOT_APPROVED, { reviews: [{ ...old, rating: 1 }] }));
    await assertFails(upd(db, SPOT_APPROVED, { reviews: [] }));
    await assertFails(upd(db, SPOT_APPROVED, { reviews: [newReview(ALICE), old] }));
    await assertFails(upd(db, SPOT_APPROVED, { reviews: [old, newReview(ALICE), newReview(ALICE, { id: `${ALICE}_1` })] }));
    await assertFails(upd(db, SPOT_LEGACY, { reviews: [newReview(ALICE)] })); // drops legacy entry
  });
  it('SEC-03/05: denies rewriting or reordering old entries alongside a valid append', async () => {
    const db = dbAs(env, ALICE);
    const old = review(BOB);
    await assertFails(upd(db, SPOT_APPROVED, { reviews: [{ ...old, rating: 1 }, newReview(ALICE)] }));
    await assertFails(upd(db, SPOT_APPROVED, { reviews: [{ ...old, comment: 'edited' }, newReview(ALICE)] }));
    const legacy = (await getDoc(doc(db, 'spots', SPOT_LEGACY))).get('reviews')[0] as Record<string, unknown>;
    await assertFails(upd(db, SPOT_LEGACY, { reviews: [without(legacy, 'userEmail'), newReview(ALICE)] }));
    const mine = newReview(ALICE);
    await assertSucceeds(append(db, SPOT_APPROVED, mine));
    const carol = dbAs(env, 'carol');
    await assertFails(upd(carol, SPOT_APPROVED, { reviews: [mine, old, newReview('carol')] }));
  });
  it('denies an append combined with another change, and an unauthenticated append', async () => {
    await assertFails(upd(dbAs(env, BOB), SPOT_APPROVED, { reviews: arrayUnion(newReview(BOB)), name: 'x' }));
    await assertFails(upd(dbAs(env, BOB), SPOT_APPROVED, { reviews: arrayUnion(newReview(BOB)), status: 'pending' }));
    await assertFails(append(dbAs(env, null), SPOT_APPROVED, newReview('anon')));
  });
});

describe('owner edits (approved spot)', () => {
  it('allows name, description and primaryImageIndex', async () => {
    const db = dbAs(env, ALICE);
    await assertSucceeds(upd(db, SPOT_APPROVED, { name: 'Renamed' }));
    await assertSucceeds(upd(db, SPOT_APPROVED, { description: 'x'.repeat(2000) }));
    await assertSucceeds(upd(db, SPOT_APPROVED, { primaryImageIndex: 1 }));
  });
  it('allows deleteSpotImage: one, then the last (placeholder), and on the legacy spot', async () => {
    const db = dbAs(env, ALICE);
    await assertSucceeds(upd(db, SPOT_APPROVED, {
      imageUrls: [IMG2], spotImages: [spotImage('2_b', IMG2, ALICE)], primaryImageIndex: 0,
    }));
    await assertSucceeds(upd(db, SPOT_APPROVED, { imageUrls: [PLACEHOLDER], spotImages: [], primaryImageIndex: 0 }));
    await assertSucceeds(upd(db, SPOT_LEGACY, { imageUrls: [IMG1], spotImages: [], primaryImageIndex: 0 }));
  });
  it('SEC-02: denies invalid values and edits of a pending spot', async () => {
    const db = dbAs(env, ALICE);
    await assertFails(upd(db, SPOT_APPROVED, { name: '' }));
    await assertFails(upd(db, SPOT_APPROVED, { description: 'x'.repeat(2001) }));
    await assertFails(upd(db, SPOT_APPROVED, { primaryImageIndex: 20 }));
    await assertFails(upd(db, SPOT_APPROVED, { primaryImageIndex: '1' }));
    await assertFails(upd(db, SPOT_PENDING, { name: 'Renamed' }));
    await assertFails(upd(db, SPOT_PENDING, { description: 'd' }));
  });
  it('SEC-02/09: denies owner changes to createdBy, status, highlighted, isHighlighted', async () => {
    const db = dbAs(env, ALICE);
    await assertFails(upd(db, SPOT_APPROVED, { createdBy: BOB }));
    await assertFails(upd(db, SPOT_APPROVED, { status: 'pending' }));
    await assertFails(upd(db, SPOT_APPROVED, { highlighted: [{ userId: ALICE }] }));
    await assertFails(upd(db, SPOT_APPROVED, { isHighlighted: true }));
    await assertFails(upd(db, SPOT_PENDING, { status: 'approved' }));
  });
  it('SEC-02/10: denies adding or swapping image URLs and changing likes', async () => {
    const db = dbAs(env, ALICE);
    await assertFails(upd(db, SPOT_APPROVED, { imageUrls: [IMG1, IMG2, 'https://evil.test/x.jpg'] }));
    await assertFails(upd(db, SPOT_APPROVED, { imageUrls: [IMG1, 'https://evil.test/x.jpg'] }));
    await assertFails(upd(db, SPOT_APPROVED, {
      spotImages: [spotImage('1_a', IMG1, ALICE, [BOB, ALICE]), spotImage('2_b', IMG2, ALICE)],
    }));
    await assertFails(upd(db, SPOT_APPROVED, {
      spotImages: [spotImage('1_a', IMG1, ALICE, []), spotImage('2_b', IMG2, ALICE)],
    }));
    await assertFails(upd(db, SPOT_LEGACY, { spotImages: [spotImage('1', IMG1, ALICE)] }));
  });
  it('SEC-02/10: denies non-owners editing name or rewriting spotImages', async () => {
    const db = dbAs(env, BOB);
    await assertFails(upd(db, SPOT_APPROVED, { name: 'Mine now' }));
    await assertFails(upd(db, SPOT_APPROVED, { spotImages: [] }));
    await assertFails(upd(db, SPOT_APPROVED, { imageUrls: [PLACEHOLDER], spotImages: [] }));
    await assertFails(upd(dbAs(env, null), SPOT_APPROVED, { name: 'anon' }));
  });
});

describe('admin and delete', () => {
  it('admin approves, edits any field and deletes', async () => {
    const db = dbAs(env, ADMIN);
    await assertSucceeds(upd(db, SPOT_PENDING, { status: 'approved' }));
    await assertSucceeds(upd(db, SPOT_APPROVED, { name: 'Admin edit', description: 'd', primaryImageIndex: 1 }));
    await assertSucceeds(upd(db, SPOT_LEGACY, { imageUrls: [IMG1], spotImages: [], primaryImageIndex: 0 }));
    await assertSucceeds(deleteDoc(doc(db, 'spots', SPOT_APPROVED)));
  });
  it('SEC-02: denies delete by owner, other users and anonymous', async () => {
    await assertFails(deleteDoc(doc(dbAs(env, ALICE), 'spots', SPOT_APPROVED)));
    await assertFails(deleteDoc(doc(dbAs(env, BOB), 'spots', SPOT_APPROVED)));
    await assertFails(deleteDoc(doc(dbAs(env, null), 'spots', SPOT_APPROVED)));
  });
});
