import { expect } from '@playwright/test';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { E2E } from './fixtures';
import { test, blockMapTiles, expectNotification, openApp, signInWithEmail, skipFirstRunOverlays } from './helpers';

// A1: legal pages. A2: account deletion through the deleteAccount callable (needs the functions
// emulator, so CI only). The deleted user and its two spots are created here and never shared.

const GONE = { uid: 'e2e-delete-me', email: 'delete-me@spoton.test', username: 'e2e_delete_me' };
const OWN_SPOT = 'e2e-delete-own-spot';
const OTHER_SPOT = 'e2e-delete-other-spot';

function admin() {
  // Same guard convention as scripts/seed-emulator.ts: never talk to a real project.
  if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    throw new Error('refusing to run: emulator hosts not set (run via firebase emulators:exec)');
  }
  if (process.env.GCLOUD_PROJECT && process.env.GCLOUD_PROJECT !== 'demo-spoton') {
    throw new Error('refusing to run: unexpected GCLOUD_PROJECT');
  }
  if (!getApps().length) initializeApp({ projectId: 'demo-spoton' });
  return { db: getFirestore(), auth: getAuth() };
}

async function cleanup() {
  const { db, auth } = admin();
  await auth.deleteUser(GONE.uid).catch(() => {});
  await Promise.all([
    db.doc(`users/${GONE.uid}`).delete(),
    db.doc(`publicProfiles/${GONE.uid}`).delete(),
    db.doc(`usernames/${GONE.username}`).delete(),
    db.doc(`spots/${OWN_SPOT}`).delete(),
    db.doc(`spots/${OTHER_SPOT}`).delete(),
  ]);
}

test.beforeEach(async ({ page }) => {
  await blockMapTiles(page);
});

test('legal pages are readable without the install prompt', async ({ page }) => {
  // No skipFirstRunOverlays: the install prompt would show on the map page, not here.
  await page.goto('/privacy');
  await expect(page.getByRole('heading', { name: 'Adatvédelmi tájékoztató' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '4. Fiók törlése' })).toBeVisible();
  await page.goto('/terms');
  await expect(page.getByRole('heading', { name: 'Felhasználási feltételek (ÁSZF)' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'SpotOn' })).toBeVisible();
});

test.describe('account deletion', () => {
  test.beforeAll(async () => {
    await cleanup();
    const { db, auth } = admin();
    const t = Timestamp.now();
    await auth.createUser({ uid: GONE.uid, email: GONE.email, password: E2E.password });
    await db.doc(`users/${GONE.uid}`).set({
      uid: GONE.uid, email: GONE.email, username: GONE.username, displayName: GONE.username,
      photoURL: '', profilePictureURL: '', profileBannerURL: '', savedSpots: [], createdAt: t, lastLoginAt: t,
    });
    await db.doc(`usernames/${GONE.username}`).set({ uid: GONE.uid });
    const spot = (createdBy: string, createdByName: string) => ({
      name: 'E2E Delete fixture', category: 'other', description: '', location: { lat: 47.6, lng: 19.3 },
      createdBy, createdByName, status: 'approved', createdAt: t,
    });
    await db.doc(`spots/${OWN_SPOT}`).set({ ...spot(GONE.uid, GONE.username), imageUrls: ['/placeholder-spot.jpg'] });
    const theirPhoto = 'https://example.com/their.jpg';
    const ownerPhoto = 'https://example.com/owner.jpg';
    await db.doc(`spots/${OTHER_SPOT}`).set({
      ...spot(E2E.user.uid, E2E.user.username),
      imageUrls: [ownerPhoto, theirPhoto],
      spotImages: [
        { id: 'a', url: ownerPhoto, addedBy: E2E.user.uid, addedAt: t, likes: 2, likedBy: [GONE.uid, E2E.admin.uid] },
        { id: 'b', url: theirPhoto, addedBy: GONE.uid, addedAt: t, likes: 0, likedBy: [] },
      ],
      primaryImageIndex: 1,
      reviews: [
        { id: 'r-gone', userId: GONE.uid, userName: GONE.username, rating: 5, comment: 'bye', createdAt: t },
        { id: 'r-user', userId: E2E.user.uid, userName: E2E.user.username, rating: 4, comment: 'stay', createdAt: t },
      ],
    });
  });
  test.afterAll(cleanup);

  test('deletes the account, anonymises own spots, removes reviews, photos and likes elsewhere', async ({ page }) => {
    await skipFirstRunOverlays(page);
    await openApp(page);
    await signInWithEmail(page, GONE.email, E2E.password);
    await page.getByRole('button', { name: 'Profile' }).click();
    await expect(page.getByRole('heading', { name: GONE.username })).toBeVisible();
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByRole('button', { name: 'Delete account' }).click();

    const confirm = page.getByLabel(/type your username/);
    const deleteButton = page.getByRole('button', { name: 'Delete permanently' });
    await expect(deleteButton).toBeDisabled();
    await confirm.fill(GONE.username);
    await deleteButton.click();
    await expectNotification(page, 'Your account has been deleted.');

    const { db, auth } = admin();
    await expect(auth.getUser(GONE.uid)).rejects.toMatchObject({ code: 'auth/user-not-found' });
    expect((await db.doc(`users/${GONE.uid}`).get()).exists).toBe(false);
    expect((await db.doc(`usernames/${GONE.username}`).get()).exists).toBe(false);
    await expect.poll(async () => (await db.doc(`publicProfiles/${GONE.uid}`).get()).exists).toBe(false);

    const own = (await db.doc(`spots/${OWN_SPOT}`).get()).data();
    expect(own).toMatchObject({ createdBy: GONE.uid, status: 'approved' });
    expect(own && 'createdByName' in own).toBe(false);

    const other = (await db.doc(`spots/${OTHER_SPOT}`).get()).data();
    expect(other?.reviews.map((r: { id: string }) => r.id)).toEqual(['r-user']);
    expect(other?.imageUrls).toEqual(['https://example.com/owner.jpg']);
    expect(other?.primaryImageIndex).toBe(0);
    expect(other?.spotImages).toMatchObject([{ id: 'a', likes: 1, likedBy: [E2E.admin.uid] }]);
  });
});
