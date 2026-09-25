// Seeds the local Firebase emulators (project demo-spoton) with deterministic, legacy-shaped
// E2E fixtures (T04). Run only via `firebase emulators:exec` (see `npm run test:e2e`).
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { E2E } from '../e2e/fixtures';

const PROJECT_ID = 'demo-spoton';

function assertEmulatorEnv(): void {
  if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    throw new Error(
      'refusing to seed: FIRESTORE_EMULATOR_HOST and FIREBASE_AUTH_EMULATOR_HOST must be set (run via firebase emulators:exec)',
    );
  }
  const project = process.env.GCLOUD_PROJECT;
  if (project !== undefined && project !== PROJECT_ID) {
    throw new Error(`refusing to seed: GCLOUD_PROJECT is "${project}", expected "${PROJECT_ID}"`);
  }
}

async function seed(): Promise<void> {
  assertEmulatorEnv();

  initializeApp({ projectId: PROJECT_ID });
  const auth = getAuth();
  const db = getFirestore();
  const t = Timestamp.fromDate(new Date('2025-06-01T12:00:00Z'));

  for (const account of [E2E.user, E2E.admin]) {
    await auth.createUser({ uid: account.uid, email: account.email, password: E2E.password });
    await db.doc(`users/${account.uid}`).set({
      uid: account.uid,
      username: account.username,
      email: account.email,
      photoURL: '',
      profilePictureURL: '',
      profileBannerURL: '',
      savedSpots: [],
      createdAt: t,
      lastLoginAt: t,
    });
  }

  // Legacy admin shape: no `role`.
  await db.doc(`admins/${E2E.admin.uid}`).set({
    email: E2E.admin.email,
    username: E2E.admin.username,
    photoURL: '',
    addedAt: t,
    addedBy: 'seed',
  });

  // LEGACY spot: only `imageUrls`, no `spotImages`/`primaryImageIndex`; review carries `userEmail`/`userSpotsCount`.
  await db.doc(`spots/${E2E.legacySpot.id}`).set({
    name: E2E.legacySpot.name,
    category: 'viewpoint',
    description: 'Legacy-shaped fixture',
    location: { lat: 47.5009, lng: 19.0452 },
    createdBy: E2E.user.uid,
    createdByName: E2E.user.username,
    status: 'approved',
    createdAt: t,
    imageUrls: ['/icon-512x512.png'],
    reviews: [
      {
        id: 'e2e-legacy-review',
        userId: E2E.admin.uid,
        userName: 'Legacy Reviewer',
        userEmail: E2E.admin.email,
        userPhoto: '',
        rating: 4,
        comment: E2E.legacySpot.reviewComment,
        createdAt: t,
        userSpotsCount: 3,
      },
    ],
  });

  await db.doc(`spots/${E2E.modernSpot.id}`).set({
    name: E2E.modernSpot.name,
    category: 'park',
    description: 'Current-shape fixture',
    location: { lat: 47.4949, lng: 19.0342 },
    createdBy: E2E.user.uid,
    createdByName: E2E.user.username,
    status: 'approved',
    createdAt: t,
    imageUrls: ['/icon-192x192.png'],
    primaryImageIndex: 0,
    spotImages: [
      { id: 'e2e-img-1', url: '/icon-192x192.png', addedBy: E2E.user.uid, addedAt: t, likes: 0, likedBy: [] },
    ],
    reviews: [],
  });

  await db.doc(`spots/${E2E.pendingSpot.id}`).set({
    name: E2E.pendingSpot.name,
    category: 'hiking',
    description: 'Pending fixture',
    location: { lat: 47.4990, lng: 19.0300 },
    createdBy: E2E.user.uid,
    createdByName: E2E.user.username,
    status: 'pending',
    createdAt: t,
    imageUrls: ['/placeholder-spot.jpg'],
    reviews: [],
  });

  console.log(`Seeded emulator project ${PROJECT_ID}`);
}

seed().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
