import { expect, type Page } from '@playwright/test';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { E2E } from './fixtures';
import { test, blockMapTiles, expectNotification, openApp, signInWithEmail, skipFirstRunOverlays, spotMarker } from './helpers';

// T28: the split SpotDetailsPanel. Uses only E2E.detailsSpot (two images, owned by admin, seeded
// as saved by `user`). The favourite and the review are reset before and after the run, so the
// fixture and the user doc always end as seeded. The panel reads the live spot from the store
// (T29); the review test still closes and reopens it, which also checks the reopened state.

const spot = E2E.detailsSpot;
const reviewComment = `E2E details review ${Date.now().toString(36)}`;

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
  const db = adminDb();
  await db.doc(`spots/${spot.id}`).update({ reviews: [] });
  await db.doc(`users/${E2E.user.uid}`).update({ savedSpots: [spot.id] });
}

async function savedSpots(): Promise<string[]> {
  return (await adminDb().doc(`users/${E2E.user.uid}`).get()).get('savedSpots') ?? [];
}

/** Map marker → info window → details panel. */
async function openDetails(page: Page) {
  await spotMarker(page, spot.emoji).click();
  await page.getByRole('button', { name: 'View Details' }).click();
  await expect(page.getByRole('heading', { name: spot.name })).toBeVisible();
}

async function closeDetails(page: Page) {
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Close spot details' })).toHaveCount(0);
}

const addFavorite = (page: Page) => page.getByRole('button', { name: 'Add to favorites', exact: true });
const removeFavorite = (page: Page) => page.getByRole('button', { name: 'Remove from favorites', exact: true });
/** A gallery dot: present only while the fullscreen gallery is open (two images). */
const galleryDot = (page: Page) => page.getByRole('button', { name: 'Go to image 1', exact: true });
/** The hero's image-count badge; a click on it bubbles to the hero and opens the gallery. */
const heroBadge = (page: Page) => page.getByText('📸 2', { exact: true });

/** Clicks the hero until the gallery opens (the hero ignores clicks for 300 ms after opening). */
async function openGallery(page: Page) {
  await expect(async () => {
    await heroBadge(page).click();
    await expect(galleryDot(page)).toBeVisible({ timeout: 1000 });
  }).toPass();
}

test.beforeAll(resetFixture);
test.afterAll(resetFixture);

test.beforeEach(async ({ page }) => {
  await skipFirstRunOverlays(page);
  await blockMapTiles(page);
});

test('favourite state follows the store (BUG-09); Close and the heart do not open the gallery (BUG-26)', async ({ page }) => {
  await openApp(page);
  await signInWithEmail(page, E2E.user.email, E2E.password);
  await openDetails(page);

  // Seeded as saved: the heart starts filled.
  await expect(removeFavorite(page)).toBeVisible();

  // The hero click guard has elapsed once the hero opens the gallery; Esc closes it again.
  await openGallery(page);
  await page.keyboard.press('Escape');
  await expect(galleryDot(page)).toHaveCount(0);

  // BUG-26: the heart toggles without opening the gallery.
  await removeFavorite(page).click();
  await expect(addFavorite(page)).toBeVisible();
  await expect(galleryDot(page)).toHaveCount(0);
  await expect.poll(savedSpots).not.toContain(spot.id);

  // BUG-26: the gallery does not carry over to the next open (the heart step above is the real
  // stopPropagation check; Close is also covered by the spot-change reset).
  await closeDetails(page);
  await expect(galleryDot(page)).toHaveCount(0);
  await openDetails(page);
  await expect(galleryDot(page)).toHaveCount(0);

  // BUG-09: the reopened panel reads the store, so the heart is empty now.
  await expect(addFavorite(page)).toBeVisible();

  // Re-favourite: the user doc ends as seeded.
  await addFavorite(page).click();
  await expect(removeFavorite(page)).toBeVisible();
  await expect.poll(savedSpots).toContain(spot.id);
});

test('gallery: ArrowRight shows the second image', async ({ page }) => {
  await openApp(page);
  await openDetails(page);

  await openGallery(page);
  await expect(page.getByText('1 / 2', { exact: true })).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByText('2 / 2', { exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: `${spot.name} - Image 2`, exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(galleryDot(page)).toHaveCount(0);
});

test('a new review is listed after reopening', async ({ page }) => {
  await openApp(page);
  await signInWithEmail(page, E2E.user.email, E2E.password);
  await openDetails(page);

  const form = page.locator('#review-comment').locator('..');
  await form.getByRole('button').nth(3).click(); // 4th star
  await page.locator('#review-comment').fill(reviewComment);
  await page.getByRole('button', { name: 'Submit Review' }).click();
  await expectNotification(page, 'Review added successfully!');

  await closeDetails(page);
  await openDetails(page);
  await expect(page.getByText(reviewComment)).toBeVisible();
  await expect(page.getByText(reviewComment)).toHaveCount(1);
});
