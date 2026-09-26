import { expect, test, type Page } from '@playwright/test';
import { getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { E2E } from './fixtures';
import { blockMapTiles, expectNotification, openApp, signInWithEmail, skipFirstRunOverlays, spotMarker } from './helpers';

// T11b: spot interactions via callables, review payload, upload paths, no write on read.
// Data assertions use firebase-admin against the Firestore emulator (FIRESTORE_EMULATOR_HOST is set
// by `firebase emulators:exec`). The details panel shows a snapshot of the spot (T29), so it is
// closed and reopened before asserting review/photo changes in the UI.
// Mutated fixtures (interactionSpot, level5.approvedSpot, spots created here) are reset before and
// after the run, so other specs and retries always see the seeded state.

test.describe.configure({ mode: 'serial' });

const NEW_SPOT_PREFIX = 'E2E Upload ';
const newSpotName = `${NEW_SPOT_PREFIX}${Date.now().toString(36)}`;
const reviewComment = `E2E interaction review ${Date.now().toString(36)}`;
const REVIEW_KEYS = new Set(['id', 'userId', 'userName', 'userPhoto', 'rating', 'comment', 'createdAt']);
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function adminDb() {
  // Same guard convention as scripts/seed-emulator.ts: never talk to a real Firestore.
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error('refusing to run: FIRESTORE_EMULATOR_HOST not set (run via firebase emulators:exec)');
  }
  if (process.env.GCLOUD_PROJECT && process.env.GCLOUD_PROJECT !== 'demo-spoton') {
    throw new Error('refusing to run: unexpected GCLOUD_PROJECT');
  }
  if (!getApps().length) initializeApp({ projectId: 'demo-spoton' });
  return getFirestore();
}

async function spotData(id: string) {
  return (await adminDb().doc(`spots/${id}`).get()).data();
}

async function resetFixtures() {
  const db = adminDb();
  await db.doc(`spots/${E2E.interactionSpot.id}`).update({
    imageUrls: ['/icon-512x512.png'],
    reviews: [],
    spotImages: FieldValue.delete(),
    primaryImageIndex: FieldValue.delete(),
  });
  await db.doc(`spots/${E2E.level5.approvedSpot.id}`).update({
    highlighted: FieldValue.delete(),
    isHighlighted: FieldValue.delete(),
  });
  await db.doc(`users/${E2E.level5.uid}`).update({ highlightedSpots: FieldValue.delete() });
  const created = await db.collection('spots').where('createdBy', '==', E2E.user.uid).get();
  await Promise.all(
    created.docs
      .filter((d) => String(d.get('name')).startsWith(NEW_SPOT_PREFIX))
      .map((d) => d.ref.delete()),
  );
}

/**
 * A real JPEG, drawn on a canvas in the page. (public/placeholder-spot.jpg is SVG markup despite its
 * extension, so the browser cannot decode it for compression.)
 */
async function jpegUpload(page: Page) {
  const base64 = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 48;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#0ea5e9';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    return canvas.toDataURL('image/jpeg', 0.9).split(',')[1];
  });
  return { name: 'e2e-photo.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(base64, 'base64') };
}

/** The storage object path encoded in a Firebase Storage download URL. */
function storagePathOf(downloadUrl: string): string {
  const { pathname } = new URL(downloadUrl);
  return decodeURIComponent(pathname.slice(pathname.indexOf('/o/') + 3));
}

async function openDetails(page: Page, emoji: string) {
  await spotMarker(page, emoji).click();
  await page.getByRole('button', { name: 'View Details' }).click();
}

async function closeDetails(page: Page) {
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Close spot details' })).toHaveCount(0);
}

let createdSpotId: string | undefined;

test.beforeAll(resetFixtures);
test.afterAll(resetFixtures);

test.beforeEach(async ({ page }) => {
  await skipFirstRunOverlays(page);
  await blockMapTiles(page);
});

test('new spot image is uploaded to spot-images/{uid}/ and the spot is pending', async ({ page }) => {
  await openApp(page);
  await signInWithEmail(page, E2E.user.email, E2E.password);

  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.locator('.leaflet-container').click({ position: { x: 300, y: 450 } });
  await page.locator('#spot-name').fill(newSpotName);
  await page.locator('#spot-image').setInputFiles(await jpegUpload(page));
  await expect(page.getByAltText('Preview 1')).toBeVisible();
  await page.getByRole('button', { name: 'Submit Spot' }).click();
  await expectNotification(page, 'Spot uploaded! Waiting for approval.');

  const snap = await adminDb().collection('spots').where('name', '==', newSpotName).get();
  expect(snap.size).toBe(1);
  const spot = snap.docs[0];
  createdSpotId = spot.id;
  expect(spot.get('status')).toBe('pending');
  const imageUrls: string[] = spot.get('imageUrls');
  expect(imageUrls).toHaveLength(1);
  const storagePath = storagePathOf(imageUrls[0]);
  expect(storagePath.startsWith(`spot-images/${E2E.user.uid}/`)).toBe(true);
  expect(storagePath.endsWith('.jpg')).toBe(true);
});

test('review is stored without email or style metadata and shows after reopening', async ({ page }) => {
  await openApp(page);
  await signInWithEmail(page, E2E.user.email, E2E.password);
  await openDetails(page, E2E.interactionSpot.emoji);

  const form = page.locator('#review-comment').locator('..');
  await form.getByRole('button').nth(3).click(); // 4th star
  await page.locator('#review-comment').fill(reviewComment);
  await page.getByRole('button', { name: 'Submit Review' }).click();
  await expectNotification(page, 'Review added successfully!');

  await closeDetails(page);
  await openDetails(page, E2E.interactionSpot.emoji);
  await expect(page.getByText(reviewComment)).toBeVisible();
  await expect(page.getByText(reviewComment)).toHaveCount(1);

  const reviews: Array<Record<string, unknown>> = (await spotData(E2E.interactionSpot.id))?.reviews ?? [];
  const last = reviews[reviews.length - 1];
  expect(last).toMatchObject({ userId: E2E.user.uid, rating: 4, comment: reviewComment });
  for (const key of Object.keys(last)) expect(REVIEW_KEYS.has(key), `unexpected review key ${key}`).toBe(true);
});

test('viewing a legacy spot does not write to it', async ({ page }) => {
  await openApp(page);
  await signInWithEmail(page, E2E.user.email, E2E.password);
  await openDetails(page, E2E.interactionSpot.emoji);

  const hero = page.getByRole('img', { name: E2E.interactionSpot.name }).first();
  await expect(hero).toBeVisible();
  // Give a (removed) write-on-read effect time to fire before checking the stored doc.
  await page.waitForTimeout(1500);

  const spot = await spotData(E2E.interactionSpot.id);
  expect(spot).toBeDefined();
  expect(spot && 'spotImages' in spot).toBe(false);
  expect(spot?.imageUrls).toEqual(['/icon-512x512.png']);
});

test('adding a photo to a legacy spot materialises its images server-side', async ({ page }) => {
  await openApp(page);
  await signInWithEmail(page, E2E.user.email, E2E.password);
  await openDetails(page, E2E.interactionSpot.emoji);

  await page.locator('input[type="file"][multiple]').setInputFiles(await jpegUpload(page));
  await expectNotification(page, 'Photos added!');

  const spot = await spotData(E2E.interactionSpot.id);
  const imageUrls: string[] = spot?.imageUrls ?? [];
  const ids = ((spot?.spotImages ?? []) as Array<{ id: string }>).map((i) => i.id);
  expect(imageUrls).toHaveLength(2);
  expect(imageUrls[0]).toBe('/icon-512x512.png');
  expect(storagePathOf(imageUrls[1]).startsWith(`spot-images/${E2E.user.uid}/`)).toBe(true);
  expect(ids).toHaveLength(2);
  expect(ids[0]).toBe(`${E2E.interactionSpot.id}_0`);
  expect(ids[1]).toMatch(/^\d+_\d+$/);

  await closeDetails(page);
  await openDetails(page, E2E.interactionSpot.emoji);
  await expect(page.getByText('📸 2')).toBeVisible();
});

test('admin approves the pending spot', async ({ page }) => {
  expect(createdSpotId, 'spot from the upload test').toBeDefined();
  await openApp(page);
  await signInWithEmail(page, E2E.admin.email, E2E.password);
  await page.getByRole('button', { name: 'Profile' }).click();
  await page.getByRole('button', { name: /Pending Approval/ }).click();

  const card = page.locator('.glass-card').filter({ hasText: newSpotName });
  await card.getByRole('button', { name: 'Approve' }).click();

  await expect.poll(async () => (await spotData(createdSpotId!))?.status).toBe('approved');
});

test('level-5 owner highlights their approved spot via the callable', async ({ page }) => {
  const spotId = E2E.level5.approvedSpot.id;
  await openApp(page);
  await signInWithEmail(page, E2E.level5.email, E2E.password);
  await openDetails(page, E2E.level5.approvedSpot.emoji);

  const highlightButton = page.getByRole('button', { name: 'Highlight this spot', exact: true });
  await highlightButton.click();
  await expectNotification(page, 'Spot highlighted! Visible for 7 days');
  // The live store copy turns the button active once the listener delivers the entry.
  await expect(highlightButton).toBeDisabled();

  const spot = await spotData(spotId);
  const entry = ((spot?.highlighted ?? []) as Array<{ userId: string; expiresAt: string }>)
    .find((h) => h.userId === E2E.level5.uid);
  expect(entry).toBeDefined();
  const msLeft = Date.parse(entry!.expiresAt) - Date.now();
  expect(Math.abs(msLeft - SEVEN_DAYS_MS)).toBeLessThan(10 * 60 * 1000);

  const user = (await adminDb().doc(`users/${E2E.level5.uid}`).get()).data();
  expect(user?.highlightedSpots).toContain(spotId);
});
