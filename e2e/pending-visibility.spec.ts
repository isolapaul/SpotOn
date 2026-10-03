import { expect, type Page } from '@playwright/test';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { E2E } from './fixtures';
import { test, blockMapTiles, expectNotification, openApp, signInWithEmail, skipFirstRunOverlays, spotMarker } from './helpers';

// T30: pending spots reach only their owner (profile list + yellow marker on their own map) and
// admins (map + pending tab).
// P = E2E.pendingSpot (owned by `user`); Q = E2E.level5.approvedSpot (owned by `level5`, whose other
// 19 spots are pending and share Q's category). Read-only for the seeded fixtures; the spot added here
// is deleted before and after the run.

const NEW_SPOT_PREFIX = 'E2E PendingVis ';
const newSpotName = `${NEW_SPOT_PREFIX}${Date.now().toString(36)}`;
const PENDING_MARKERS = '.leaflet-marker-icon .spot-pin[data-variant="pending"]';

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

async function deleteCreatedSpots() {
  const created = await adminDb().collection('spots').where('createdBy', '==', E2E.user.uid).get();
  await Promise.all(
    created.docs
      .filter((d) => String(d.get('name')).startsWith(NEW_SPOT_PREFIX))
      .map((d) => d.ref.delete()),
  );
}

test.beforeAll(deleteCreatedSpots);
test.afterAll(deleteCreatedSpots);

test.beforeEach(async ({ page }) => {
  await skipFirstRunOverlays(page);
  await blockMapTiles(page);
});

async function openProfile(page: Page, username: string) {
  await page.getByRole('button', { name: 'Profile' }).click();
  await expect(page.getByRole('heading', { name: username })).toBeVisible();
}

test('signed out: approved markers only', async ({ page }) => {
  await openApp(page);
  await expect(spotMarker(page, E2E.level5.approvedSpot.category)).toHaveCount(1);
  await expect(spotMarker(page, E2E.pendingSpot.category)).toHaveCount(0);
  await expect(page.locator(PENDING_MARKERS)).toHaveCount(0);
});

test('owner: own pending spot in yellow on the map and in my spots, never other users\' pending', async ({ page }) => {
  await openApp(page);
  await signInWithEmail(page, E2E.user.email, E2E.password);
  // The own-spots listener follows sign-in; level5's 19 pending spots (same category as Q) stay hidden.
  await expect(spotMarker(page, E2E.pendingSpot.category).locator('.spot-pin[data-variant="pending"]')).toHaveCount(1);
  await expect(spotMarker(page, E2E.level5.approvedSpot.category)).toHaveCount(1);

  await openProfile(page, E2E.user.username);
  const card = page.locator(`button[aria-label="${E2E.pendingSpot.name}"]`); // the profile card, not the pin
  await expect(card).toBeVisible();
  await expect(card.getByText('Pending', { exact: true })).toBeVisible();
});

test('admin: pending spots on the map and in the pending tab', async ({ page }) => {
  await openApp(page);
  await signInWithEmail(page, E2E.admin.email, E2E.password);
  // Admin state resolves after sign-in; the pending markers follow once the admin listener delivers.
  await expect(spotMarker(page, E2E.pendingSpot.category).locator('.spot-pin[data-variant="pending"]')).toHaveCount(1);
  await expect(spotMarker(page, E2E.level5.approvedSpot.category)).toHaveCount(20);

  await openProfile(page, E2E.admin.username);
  const pendingTab = page.getByRole('button', { name: /Pending Approval/ });
  await expect(pendingTab).toHaveText(/Pending Approval\s*[1-9]\d*/);
  await pendingTab.click();
  await expect(page.locator('.glass-card').filter({ hasText: E2E.pendingSpot.name })).toBeVisible();
});

test('owner: a new spot appears in the profile at once, as pending', async ({ page }) => {
  await openApp(page);
  await signInWithEmail(page, E2E.user.email, E2E.password);

  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.locator('.leaflet-container').click({ position: { x: 300, y: 450 } });
  await page.locator('#spot-name').fill(newSpotName);
  await page.getByRole('button', { name: 'Submit Spot' }).click();
  await expectNotification(page, 'Spot uploaded! Waiting for approval.');
  // The seeded pending spot plus the new one (other specs may add more of the user's own).
  await expect.poll(() => page.locator(PENDING_MARKERS).count()).toBeGreaterThanOrEqual(2);

  await openProfile(page, E2E.user.username);
  const card = page.locator(`button[aria-label="${newSpotName}"]`); // the profile card, not the pin
  await expect(card).toBeVisible();
  await expect(card.getByText('Pending', { exact: true })).toBeVisible();
});
