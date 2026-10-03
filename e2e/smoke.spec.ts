import { expect } from '@playwright/test';
import { E2E, EXPECTED_APPROVED_MARKERS } from './fixtures';
import { test, blockMapTiles, openApp, signInWithEmail, skipFirstRunOverlays, spotMarker } from './helpers';

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
  await expect(page.locator('.spot-marker .spot-pin[data-variant="approved"]')).toHaveCount(EXPECTED_APPROVED_MARKERS);
  await expect(spotMarker(page, E2E.legacySpot.category)).toHaveCount(1);
  await expect(spotMarker(page, E2E.modernSpot.category)).toHaveCount(1);
  await expect(spotMarker(page, E2E.pendingSpot.category)).toHaveCount(0);
});

test('legacy spot details', async ({ page }) => {
  await openApp(page);
  await spotMarker(page, E2E.legacySpot.category).click();
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
