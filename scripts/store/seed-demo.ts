// Seeds the local emulators (project demo-spoton) with the store-screenshot demo content
// (scripts/store/demo-data.ts). Run only via `npm run store:assets` (firebase emulators:exec).
import { randomUUID } from 'node:crypto';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { TERMS_VERSION } from '../../src/lib/terms';
import { DEMO_PASSWORD, DEMO_SPOTS, DEMO_USERS, PEXELS_URL, type DemoSpot } from './demo-data';

const PROJECT_ID = 'demo-spoton';
const BUCKET = 'demo-spoton.appspot.com';

function assertEmulatorEnv(): string {
  const storageHost = process.env.FIREBASE_STORAGE_EMULATOR_HOST;
  if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST || !storageHost) {
    throw new Error('refusing to seed: the Firestore, Auth and Storage emulator hosts must be set (run via firebase emulators:exec)');
  }
  const project = process.env.GCLOUD_PROJECT;
  if (project !== undefined && project !== PROJECT_ID) {
    throw new Error(`refusing to seed: GCLOUD_PROJECT is "${project}", expected "${PROJECT_ID}"`);
  }
  return storageHost;
}

const daysAgo = (days: number) => Timestamp.fromMillis(Date.now() - days * 86_400_000);

/** Downloads a Pexels photo and stores it where the app puts uploads; returns its download URL. */
async function uploadPhoto(storageHost: string, ownerUid: string, photoId: number): Promise<string> {
  const response = await fetch(PEXELS_URL(photoId));
  if (!response.ok) throw new Error(`photo ${photoId}: HTTP ${response.status}`);
  const path = `spot-images/${ownerUid}/${randomUUID()}.jpg`;
  const token = randomUUID();
  await getStorage().bucket(BUCKET).file(path).save(Buffer.from(await response.arrayBuffer()), {
    contentType: 'image/jpeg',
    metadata: { metadata: { firebaseStorageDownloadTokens: token } },
  });
  return `http://${storageHost}/v0/b/${BUCKET}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
}

async function spotDoc(storageHost: string, spot: DemoSpot) {
  const owner = DEMO_USERS[spot.owner];
  const addedAt = daysAgo(spot.daysAgo);
  const urls = await Promise.all(spot.photos.map((id) => uploadPhoto(storageHost, owner.uid, id)));
  return {
    name: spot.name,
    category: spot.category,
    description: spot.description,
    location: spot.location,
    createdBy: owner.uid,
    createdByName: owner.username,
    createdByPhoto: '',
    status: spot.status,
    createdAt: addedAt,
    imageUrls: urls,
    primaryImageIndex: 0,
    spotImages: urls.map((url, i) => ({ id: `${spot.id}-img-${i}`, url, addedBy: owner.uid, addedAt, likes: 0, likedBy: [] })),
    reviews: spot.reviews.map((r, i) => ({
      id: `${DEMO_USERS[r.by].uid}_${spot.id}_${i}`,
      userId: DEMO_USERS[r.by].uid,
      userName: DEMO_USERS[r.by].username,
      userPhoto: '',
      rating: r.rating,
      comment: r.comment,
      createdAt: daysAgo(r.daysAgo),
    })),
  };
}

async function seed(): Promise<void> {
  const storageHost = assertEmulatorEnv();
  initializeApp({ projectId: PROJECT_ID, storageBucket: BUCKET });
  const auth = getAuth();
  const db = getFirestore();
  const created = daysAgo(90);

  for (const user of Object.values(DEMO_USERS)) {
    const spotsCount = DEMO_SPOTS.filter((s) => DEMO_USERS[s.owner].uid === user.uid).length;
    await auth.createUser({ uid: user.uid, email: user.email, password: DEMO_PASSWORD });
    await db.doc(`users/${user.uid}`).set({
      uid: user.uid,
      username: user.username,
      email: user.email,
      photoURL: '',
      profilePictureURL: '',
      profileBannerURL: '',
      savedSpots: ['demo-parliament-golden-hour', 'demo-danube-night'],
      createdAt: created,
      lastLoginAt: created,
      termsVersion: TERMS_VERSION,
      spotsCount,
    });
    await db.doc(`usernames/${user.username}`).set({ uid: user.uid });
    await db.doc(`publicProfiles/${user.uid}`).set({ username: user.username, profilePictureURL: '', spotsCount });
  }

  for (const spot of DEMO_SPOTS) {
    await db.doc(`spots/${spot.id}`).set(await spotDoc(storageHost, spot));
  }
  console.log(`Seeded ${DEMO_SPOTS.length} demo spots into ${PROJECT_ID}`);
}

seed().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
