import { expect, test } from '@playwright/test';
import { E2E, EXPECTED_APPROVED_MARKERS } from './fixtures';
import { blockMapTiles, openApp, signInWithEmail, skipFirstRunOverlays, spotMarker } from './helpers';

test.beforeEach(async ({ page }) => {
  await skipFirstRunOverlays(page);
  await blockMapTiles(page);
});

test('app loads past overlays', async ({ page }) => {
  await openApp(page);
  await expect(page.getByText('Continue on web')).toHaveCount(0);
  await expect(page.getByText('Select Language')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Profile' })).toBeVisible();
});

test('approved markers only', async ({ page }) => {
  await openApp(page);
  await expect(page.locator('.leaflet-marker-icon circle[fill="#10b981"]')).toHaveCount(EXPECTED_APPROVED_MARKERS);
  await expect(spotMarker(page, E2E.legacySpot.emoji)).toHaveCount(1);
  await expect(spotMarker(page, E2E.modernSpot.emoji)).toHaveCount(1);
  await expect(spotMarker(page, E2E.pendingSpot.emoji)).toHaveCount(0);
});

test('legacy spot details', async ({ page }) => {
  await openApp(page);
  await spotMarker(page, E2E.legacySpot.emoji).click();
  await page.getByRole('button', { name: 'View Details' }).click();

  const img = page.getByRole('img', { name: E2E.legacySpot.name }).first();
  await expect(img).toBeVisible();
  await expect
    .poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0))
    .toBe(true);
  await expect(page.getByText(E2E.legacySpot.reviewComment)).toBeVisible();
});

test('email sign-in', async ({ page }) => {
  await openApp(page);
  await signInWithEmail(page, E2E.user.email, E2E.password);
  await page.getByRole('button', { name: 'Profile' }).click();
  await expect(page.getByRole('heading', { name: E2E.user.username })).toBeVisible();
});
