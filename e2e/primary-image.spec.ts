import { expect, type Page } from '@playwright/test';
import { getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { E2E } from './fixtures';
import { test, blockMapTiles, expectNotification, openApp, signInWithEmail, skipFirstRunOverlays, spotMarker } from './helpers';

// T21 (BUG-03): "set primary" in the image manager targets the clicked image, even when imageUrls
// starts with the placeholder. Deleting an image keeps the same image primary (BUG-27) through the
// owner-edit rule. The fixture is reset before and after the run (and at the start of the delete
// test), so retries always see the seeded state. The details panel reads the live spot (T29); it is still closed and reopened
// before asserting, which also checks the reopened state.

const spot = E2E.primaryImageSpot;
const [, urlA, urlB] = spot.imageUrls;
const fileName = (url: string) => url.slice(url.lastIndexOf('/') + 1);

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

async function resetFixture() {
  // The seeded fixture is legacy-shaped: no spotImages (a delete writes spotImages: []).
  await adminDb().doc(`spots/${spot.id}`).update({
    imageUrls: [...spot.imageUrls],
    primaryImageIndex: 0,
    spotImages: FieldValue.delete(),
  });
}

async function openDetails(page: Page) {
  await spotMarker(page, spot.emoji).click();
  await page.getByRole('button', { name: 'View Details' }).click();
}

async function closeDetails(page: Page) {
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Close spot details' })).toHaveCount(0);
}

/** A tile in the "Manage images" grid, identified by its image file. */
function managerTile(page: Page, url: string) {
  return page.locator('div.group').filter({ has: page.locator(`img[src*="${fileName(url)}"]`) });
}

test.beforeAll(resetFixture);
test.afterAll(resetFixture);

test.beforeEach(async ({ page }) => {
  await skipFirstRunOverlays(page);
  await blockMapTiles(page);
});

test('set primary in the image manager targets the clicked image', async ({ page }) => {
  await openApp(page);
  await signInWithEmail(page, E2E.user.email, E2E.password);
  await openDetails(page);

  await page.getByRole('button', { name: /Manage images/ }).click();
  const tileB = managerTile(page, urlB);
  await tileB.hover();
  await tileB.getByTitle('Set as primary image').click();
  await expectNotification(page, 'Primary image set!');

  await closeDetails(page);
  await openDetails(page);

  const hero = page.getByRole('img', { name: spot.name, exact: true });
  await expect.poll(() => hero.getAttribute('src')).toContain(fileName(urlB));

  // The reopened panel starts with the image manager collapsed and no gallery (T28, BUG-26).
  await page.getByRole('button', { name: /Manage images/ }).click();
  await expect(tileB.getByText('★')).toBeVisible();
  await expect(managerTile(page, urlA).getByText('★')).toHaveCount(0);
});

test('deleting an image before the primary keeps the same image primary', async ({ page }) => {
  await resetFixture();
  await adminDb().doc(`spots/${spot.id}`).update({ primaryImageIndex: 2 }); // urlB

  await openApp(page);
  await signInWithEmail(page, E2E.user.email, E2E.password);
  await openDetails(page);

  await page.getByRole('button', { name: /Manage images/ }).click();
  const tileA = managerTile(page, urlA);
  await tileA.hover();
  page.once('dialog', (dialog) => dialog.accept());
  await tileA.getByTitle('Delete image').click();
  await expectNotification(page, 'Image deleted!');

  const data = (await adminDb().doc(`spots/${spot.id}`).get()).data();
  expect(data?.imageUrls).toEqual([spot.imageUrls[0], urlB]);
  expect(data?.primaryImageIndex).toBe(1);
  expect(data?.spotImages).toEqual([]);

  await closeDetails(page);
  await openDetails(page);
  const hero = page.getByRole('img', { name: spot.name, exact: true });
  await expect.poll(() => hero.getAttribute('src')).toContain(fileName(urlB));
  await page.getByRole('button', { name: /Manage images/ }).click();
  await expect(managerTile(page, urlA)).toHaveCount(0);
  await expect(managerTile(page, urlB).getByText('★')).toBeVisible();
});
