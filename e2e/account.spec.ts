import { expect } from '@playwright/test';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { TERMS_VERSION } from '../src/lib/terms';
import { E2E } from './fixtures';
import { test, blockMapTiles, expectNotification, openApp, signInWithEmail, skipFirstRunOverlays } from './helpers';

// A1: legal pages. A2: account deletion through the deleteAccount callable (needs the functions
// emulator, so CI only). The deleted user and its two spots are created here and never shared, as
// is the user who accepts the terms (A1).

const GONE = { uid: 'e2e-delete-me', email: 'delete-me@spoton.test', username: 'e2e_delete_me' };
const OWN_SPOT = 'e2e-delete-own-spot';
const OTHER_SPOT = 'e2e-delete-other-spot';
const LEGACY = { uid: 'e2e-terms', email: 'terms@spoton.test', username: 'e2e_terms' };
// Google Play: deleted through the public /account-deletion page.
const WEB_GONE = { uid: 'e2e-web-delete', email: 'web-delete@spoton.test', username: 'e2e_web_delete' };

/**
 * The Auth emulator's REST API with its admin token ("Bearer owner"). Not firebase-admin/auth: its
 * jwks-rsa → jose (ESM-only) chain cannot be required under Playwright's TS loader, which fails the
 * whole run at load time.
 */
const emulatorAuth = {
  async call(action: string, body: Record<string, unknown>) {
    const url = `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/projects/demo-spoton/accounts${action}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`auth emulator ${action || 'create'}: ${res.status} ${await res.text()}`);
    return res.json() as Promise<{ users?: unknown[] }>;
  },
  createUser: (u: { uid: string; email: string; password: string }) =>
    emulatorAuth.call('', { localId: u.uid, email: u.email, password: u.password }),
  deleteUser: (uid: string) => emulatorAuth.call(':delete', { localId: uid }),
  exists: async (uid: string) => ((await emulatorAuth.call(':lookup', { localId: [uid] })).users?.length ?? 0) > 0,
};

function admin() {
  // Same guard convention as scripts/seed-emulator.ts: never talk to a real project.
  if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    throw new Error('refusing to run: emulator hosts not set (run via firebase emulators:exec)');
  }
  if (process.env.GCLOUD_PROJECT && process.env.GCLOUD_PROJECT !== 'demo-spoton') {
    throw new Error('refusing to run: unexpected GCLOUD_PROJECT');
  }
  if (!getApps().length) initializeApp({ projectId: 'demo-spoton' });
  return { db: getFirestore(), auth: emulatorAuth };
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

test('legal pages are readable without the first-run tour', async ({ page }) => {
  // No skipFirstRunOverlays: the tour would show on the map page, never on these pages.
  await page.goto('/privacy');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Adatvédelmi tájékoztató' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '4. Fiók törlése' })).toBeVisible();
  await page.goto('/terms');
  await expect(page.getByRole('heading', { name: 'Felhasználási feltételek (ÁSZF)' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'SpotOn' })).toBeVisible();
  // Item 9: the English translations, linked both ways, readable without the tour too.
  await page.getByRole('link', { name: 'English' }).click();
  await expect(page.getByRole('heading', { name: 'Terms of Use' })).toBeVisible();
  await expect(page.getByText('the Hungarian version is authoritative')).toBeVisible();
  await page.goto('/privacy/en');
  await expect(page.getByRole('heading', { name: '4. Deleting your account' })).toBeVisible();
  await page.getByRole('link', { name: 'Magyar változat' }).click();
  await expect(page.getByRole('heading', { name: 'Adatvédelmi tájékoztató' })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'A SpotOn bemutatója' })).toHaveCount(0);
});

test('the sign-in sheet links the terms and the privacy policy (sign-in-wrap)', async ({ page }) => {
  await skipFirstRunOverlays(page);
  await openApp(page);
  await page.getByRole('button', { name: 'Profile' }).click();
  await expect(page.getByText(/confirm that you are at least 16/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Terms of Use' })).toHaveAttribute('href', '/terms/en');
  await expect(page.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy/en');
});

test.describe('terms acceptance of an existing user', () => {
  test.beforeAll(async () => {
    const { db, auth } = admin();
    await auth.deleteUser(LEGACY.uid).catch(() => {});
    await auth.createUser({ uid: LEGACY.uid, email: LEGACY.email, password: E2E.password });
    const t = Timestamp.now();
    // A users doc from before the terms: no termsVersion.
    await db.doc(`users/${LEGACY.uid}`).set({
      uid: LEGACY.uid, email: LEGACY.email, username: LEGACY.username,
      photoURL: '', profilePictureURL: '', profileBannerURL: '', savedSpots: [], createdAt: t, lastLoginAt: t,
    });
  });
  test.afterAll(async () => {
    const { db, auth } = admin();
    await auth.deleteUser(LEGACY.uid).catch(() => {});
    await db.doc(`users/${LEGACY.uid}`).delete();
    await db.doc(`publicProfiles/${LEGACY.uid}`).delete();
  });

  test('is asked once, and the acceptance is recorded', async ({ page }) => {
    await skipFirstRunOverlays(page);
    await openApp(page);
    await signInWithEmail(page, LEGACY.email, E2E.password);
    const prompt = page.getByRole('dialog', { name: 'Terms' });
    await expect(prompt).toBeVisible();
    await expect(prompt.getByRole('link', { name: 'Terms of Use' })).toHaveAttribute('href', '/terms/en');
    await prompt.getByRole('button', { name: 'Accept' }).click();
    await expect(prompt).toHaveCount(0);

    const doc = (await admin().db.doc(`users/${LEGACY.uid}`).get()).data();
    expect(doc?.termsVersion).toBe(TERMS_VERSION);
    expect(doc?.termsAcceptedAt).toBeInstanceOf(Timestamp);

    await openApp(page);
    await expect(page.getByRole('button', { name: 'Profile' })).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Terms' })).toHaveCount(0);
  });
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
      termsVersion: TERMS_VERSION,
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
    expect(await auth.exists(GONE.uid)).toBe(false);
    expect((await db.doc(`users/${GONE.uid}`).get()).exists).toBe(false);
    expect((await db.doc(`usernames/${GONE.username}`).get()).exists).toBe(false);
    await expect.poll(async () => (await db.doc(`publicProfiles/${GONE.uid}`).get()).exists).toBe(false);

    const own = (await db.doc(`spots/${OWN_SPOT}`).get()).data();
    expect(own).toMatchObject({ createdBy: 'deleted-user', status: 'approved' });
    expect(own && 'createdByName' in own).toBe(false);

    const other = (await db.doc(`spots/${OTHER_SPOT}`).get()).data();
    expect(other?.reviews.map((r: { id: string }) => r.id)).toEqual(['r-user']);
    expect(other?.imageUrls).toEqual(['https://example.com/owner.jpg']);
    expect(other?.primaryImageIndex).toBe(0);
    expect(other?.spotImages).toMatchObject([{ id: 'a', likes: 1, likedBy: [E2E.admin.uid] }]);
  });
});

test('assetlinks.json is served as JSON (empty without ANDROID_CERT_SHA256)', async ({ request }) => {
  const res = await request.get('/.well-known/assetlinks.json');
  expect(res.ok()).toBe(true);
  expect(res.headers()['content-type']).toContain('application/json');
  expect(await res.json()).toEqual([]);
});

test.describe('account deletion page (Google Play)', () => {
  const removeWebGone = async () => {
    const { db, auth } = admin();
    await auth.deleteUser(WEB_GONE.uid).catch(() => {});
    await Promise.all([
      db.doc(`users/${WEB_GONE.uid}`).delete(),
      db.doc(`publicProfiles/${WEB_GONE.uid}`).delete(),
      db.doc(`usernames/${WEB_GONE.username}`).delete(),
    ]);
  };
  test.beforeAll(async () => {
    await removeWebGone();
    const { db, auth } = admin();
    const t = Timestamp.now();
    await auth.createUser({ uid: WEB_GONE.uid, email: WEB_GONE.email, password: E2E.password });
    await db.doc(`users/${WEB_GONE.uid}`).set({
      uid: WEB_GONE.uid, email: WEB_GONE.email, username: WEB_GONE.username,
      photoURL: '', profilePictureURL: '', profileBannerURL: '', savedSpots: [], createdAt: t, lastLoginAt: t,
      termsVersion: TERMS_VERSION,
    });
    await db.doc(`usernames/${WEB_GONE.username}`).set({ uid: WEB_GONE.uid });
  });
  test.afterAll(removeWebGone);

  test('explains deletion without the first-run tour, then deletes after sign-in', async ({ page }) => {
    // Only the language is seeded: the tour must not cover this page.
    await page.addInitScript(() => {
      window.localStorage.setItem('spoton-language', JSON.stringify({ state: { language: 'en', hasSelectedLanguage: true }, version: 0 }));
    });
    await page.goto('/account-deletion');
    await expect(page.getByRole('heading', { name: 'Delete your SpotOn account' })).toBeVisible();
    await expect(page.getByText('Open SpotOn, tap your profile, open Settings and tap Delete account.')).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'SpotOn tour' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.getByRole('button', { name: 'With Email' }).click();
    await page.locator('input[type="email"]').fill(WEB_GONE.email);
    await page.locator('input[type="password"]').fill(E2E.password);
    await page.locator('form button[type="submit"]').click();
    await expect(page.getByText(`Signed in as ${WEB_GONE.username}`)).toBeVisible();

    await page.getByRole('button', { name: 'Delete account' }).click();
    await page.getByLabel(/type your username/).fill(WEB_GONE.username);
    await page.getByRole('button', { name: 'Delete permanently' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Your account has been deleted.' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign In' })).toHaveCount(0);

    const { db, auth } = admin();
    expect(await auth.exists(WEB_GONE.uid)).toBe(false);
    expect((await db.doc(`users/${WEB_GONE.uid}`).get()).exists).toBe(false);
  });
});
