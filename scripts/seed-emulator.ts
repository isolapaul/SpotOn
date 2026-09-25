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

  const userDoc = (uid: string, username: string, email: string) => ({
    uid,
    username,
    email,
    photoURL: '',
    profilePictureURL: '',
    profileBannerURL: '',
    savedSpots: [],
    createdAt: t,
    lastLoginAt: t,
  });

  for (const account of [E2E.user, E2E.admin, E2E.superAdmin, E2E.level5]) {
    await auth.createUser({ uid: account.uid, email: account.email, password: E2E.password });
    await db.doc(`users/${account.uid}`).set(userDoc(account.uid, account.username, account.email));
  }

  // Backfill fixtures (T09), users docs only (no Auth users): a duplicate username pair and an
  // invalid legacy username. The backfill must report them and never rewrite them.
  for (const uid of ['e2e-dup-a', 'e2e-dup-b']) {
    await db.doc(`users/${uid}`).set(userDoc(uid, 'dup_name', ''));
  }
  await db.doc('users/e2e-invalid').set(userDoc('e2e-invalid', 'Béla', ''));

  // Legacy admin shape: no `role`.
  await db.doc(`admins/${E2E.admin.uid}`).set({
    email: E2E.admin.email,
    username: E2E.admin.username,
    photoURL: '',
    addedAt: t,
    addedBy: 'seed',
  });

  // Super admin (T08): identified server-side by `role: 'super'`.
  await db.doc(`admins/${E2E.superAdmin.uid}`).set({
    email: E2E.superAdmin.email,
    username: E2E.superAdmin.username,
    photoURL: '',
    addedAt: t,
    addedBy: 'seed',
    role: 'super',
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

  // Level-5 owner (T09): 20 spots, category `random` (unused by other fixtures). Only spot-01 is
  // approved (near the map centre, apart from the other fixtures); spots 02-20 are pending and
  // sit ~2.5 km away. spotsCount is not seeded (the functions/backfill compute it).
  for (let i = 1; i <= 20; i++) {
    const nn = String(i).padStart(2, '0');
    const id = `e2e-level5-spot-${nn}`;
    const approved = id === E2E.level5.approvedSpot.id;
    await db.doc(`spots/${id}`).set({
      name: approved ? E2E.level5.approvedSpot.name : `E2E Level5 Pending ${nn}`,
      category: 'random',
      description: approved ? 'Level 5 approved fixture' : 'Level 5 pending fixture',
      location: approved
        ? { lat: 47.4930, lng: 19.0470 }
        : { lat: 47.4800 + Math.floor((i - 2) / 5) * 0.002, lng: 19.0600 + ((i - 2) % 5) * 0.002 },
      createdBy: E2E.level5.uid,
      createdByName: E2E.level5.username,
      status: approved ? 'approved' : 'pending',
      createdAt: t,
      imageUrls: ['/placeholder-spot.jpg'],
      reviews: [],
    });
  }

  console.log(`Seeded emulator project ${PROJECT_ID}`);
}

seed().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
