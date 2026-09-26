import { expect, test, type Page } from '@playwright/test';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { E2E } from './fixtures';
import { blockMapTiles, expectNotification, openApp, signInWithEmail, skipFirstRunOverlays, spotMarker } from './helpers';

// T21 (BUG-03): "set primary" in the image manager targets the clicked image, even when imageUrls
// starts with the placeholder. The fixture is reset before and after the run, so retries always
// see the seeded state. The details panel shows a snapshot of the spot (T29), so it is closed and
// reopened before asserting.

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
  await adminDb().doc(`spots/${spot.id}`).update({ imageUrls: [...spot.imageUrls], primaryImageIndex: 0 });
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

  // Pre-existing (not part of T21): the hero's Close click also bubbles to the hero and opens the
  // gallery, and panel state survives close/reopen until T28. Esc closes the gallery; the manager
  // is opened only if it is not still open. TODO(T28): click Manage images unconditionally once panel state resets.
  await page.keyboard.press('Escape');
  if (!(await tileB.isVisible())) await page.getByRole('button', { name: /Manage images/ }).click();
  await expect(tileB.getByText('★')).toBeVisible();
  await expect(managerTile(page, urlA).getByText('★')).toHaveCount(0);
});
