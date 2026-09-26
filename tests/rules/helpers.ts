// Shared setup for the Firestore/Storage rules tests (T12). Runs only inside
// `firebase emulators:exec` (see `npm run test:rules`), which sets the emulator host env vars.
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  type RulesTestContext,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, Timestamp, type Firestore } from 'firebase/firestore';

export const PROJECT_ID = 'demo-spoton';
export const PLACEHOLDER = '/placeholder-spot.jpg';

export const ALICE = 'alice';
export const BOB = 'bob';
export const ADMIN = 'adminUid';
export const SUPER = 'superUid';

export const SPOT_APPROVED = 'approvedSpot';
export const SPOT_PENDING = 'pendingSpot';
export const SPOT_LEGACY = 'legacySpot';
export const SPOT_NO_REVIEWS = 'noReviewsSpot';

export const T0 = Timestamp.fromDate(new Date('2025-06-01T12:00:00Z'));

function hostPort(envVar: string): { host: string; port: number } {
  const value = process.env[envVar];
  if (!value) throw new Error(`${envVar} is not set: run the rules tests via \`npm run test:rules\``);
  const i = value.lastIndexOf(':');
  return { host: value.slice(0, i), port: Number(value.slice(i + 1)) };
}

export async function setupEnv(): Promise<RulesTestEnvironment> {
  return initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), ...hostPort('FIRESTORE_EMULATOR_HOST') },
    storage: { rules: readFileSync('storage.rules', 'utf8'), ...hostPort('FIREBASE_STORAGE_EMULATOR_HOST') },
  });
}

export function spotImage(id: string, url: string, addedBy: string, likedBy: string[] = []) {
  return { id, url, addedBy, addedAt: T0, likes: likedBy.length, likedBy };
}

export function review(userId: string, extra: Record<string, unknown> = {}) {
  return { id: `${userId}_1717243200000`, userId, userName: userId, rating: 4, comment: 'ok', createdAt: T0, ...extra };
}

const IMG1 = 'https://example.test/a.jpg';
const IMG2 = 'https://example.test/b.jpg';
export const IMAGES = { IMG1, IMG2 };

/** Seeds the baseline fixtures with rules disabled (the Admin-SDK equivalent). */
export async function seed(env: RulesTestEnvironment): Promise<void> {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore() as unknown as Firestore;
    const base = {
      category: 'scenic',
      description: 'desc',
      location: { lat: 47.5, lng: 19.05 },
      createdBy: ALICE,
      createdByName: 'alice',
      createdByPhoto: '',
      imageUrls: [IMG1, IMG2],
      spotImages: [spotImage('1_a', IMG1, ALICE, [BOB]), spotImage('2_b', IMG2, ALICE)],
      primaryImageIndex: 0,
      createdAt: T0,
      highlighted: [],
      isHighlighted: false,
    };
    await setDoc(doc(db, 'spots', SPOT_APPROVED), {
      ...base, name: 'Approved', status: 'approved', reviews: [review(BOB)],
    });
    await setDoc(doc(db, 'spots', SPOT_PENDING), { ...base, name: 'Pending', status: 'pending', reviews: [] });
    await setDoc(doc(db, 'spots', SPOT_NO_REVIEWS), { ...base, name: 'No reviews', status: 'approved' });
    // Legacy shape: imageUrls only (no spotImages), a review with userEmail/userSpotsCount, no highlight fields.
    await setDoc(doc(db, 'spots', SPOT_LEGACY), {
      name: 'Legacy',
      category: 'other',
      description: '',
      location: { lat: 47, lng: 19 },
      createdBy: ALICE,
      createdByName: 'alice',
      imageUrls: [IMG1, IMG2],
      status: 'approved',
      createdAt: T0,
      reviews: [{
        id: 'legacy_1', userId: BOB, userName: 'bob', userEmail: 'bob@example.test',
        userSpotsCount: 3, customNameColor: 'red', rating: 5, comment: 'old', createdAt: T0,
      }],
    });
    await setDoc(doc(db, 'admins', ADMIN), { email: 'admin@example.test', username: 'admin', addedAt: T0, addedBy: SUPER });
    await setDoc(doc(db, 'admins', SUPER), { email: 'super@example.test', username: 'super', role: 'super', addedAt: T0, addedBy: 'bootstrap' });
    await setDoc(doc(db, 'users', ALICE), {
      uid: ALICE, email: 'alice@example.test', username: 'alice', photoURL: '', profilePictureURL: '',
      profileBannerURL: '', savedSpots: ['s1'], fcmTokens: ['tok1', 'tok2'], createdAt: T0, lastLoginAt: T0,
      notificationsEnabled: true, notificationSettings: { spotApproved: true, spotReviewed: true, newPendingSpot: true },
    });
    await setDoc(doc(db, 'publicProfiles', ALICE), { username: 'alice', photoURL: '', spotsCount: 2 });
    await setDoc(doc(db, 'usernames', 'alice'), { uid: ALICE });
    await setDoc(doc(db, 'categories', 'c1'), { name: 'Cat', icon: 'x', createdAt: T0 });
  });
}

/** Firestore of an authenticated user (email claim set for the users email check). */
export function dbAs(env: RulesTestEnvironment, uid: string | null): Firestore {
  const ctx: RulesTestContext = uid === null
    ? env.unauthenticatedContext()
    : env.authenticatedContext(uid, { email: `${uid}@example.test`, email_verified: true });
  return ctx.firestore() as unknown as Firestore;
}
