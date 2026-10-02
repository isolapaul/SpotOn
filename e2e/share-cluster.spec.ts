import { expect } from '@playwright/test';
import { E2E } from './fixtures';
import { test, blockMapTiles, expectNotification, openApp, signInWithEmail, skipFirstRunOverlays } from './helpers';

// Shareable links (/spot/<id>) with a link preview, and map pin clusters. Read-only.

test.beforeEach(async ({ page }) => {
  await skipFirstRunOverlays(page);
  await blockMapTiles(page);
});

test('a shared link opens the spot\'s place card, and its preview names the spot', async ({ page }) => {
  await page.goto(`/spot/${E2E.detailsSpot.id}`);
  await expect(page).toHaveTitle(`${E2E.detailsSpot.name} · SpotOn`);
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', E2E.detailsSpot.name);
  await expect(page.getByTestId('loading-screen')).toHaveCount(0, { timeout: 30_000 });
  await expect(page.getByRole('button', { name: 'View details' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(E2E.detailsSpot.name).first()).toBeVisible();
  await expect.poll(() => page.evaluate(() => location.pathname)).toBe('/');
});

test('a link to a spot under review is not available for others', async ({ page }) => {
  await page.goto(`/spot/${E2E.pendingSpot.id}`);
  await expect(page).toHaveTitle('SpotOn');
  await expect(page.getByTestId('loading-screen')).toHaveCount(0, { timeout: 30_000 });
  await page.waitForTimeout(7000);
  await expectNotification(page, 'This spot is not available.');
});

test('zoomed out, the level-5 owner\'s nearby spots under review merge into a cluster that splits on a tap', async ({ page }) => {
  await openApp(page);
  await signInWithEmail(page, E2E.level5.email, E2E.password);
  // Zoomed out from the city view, the nearby pins merge.
  await page.waitForTimeout(1500);
  await page.mouse.move(640, 360);
  for (let i = 0; i < 3; i++) {
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(250);
  }
  const cluster = page.locator('.spot-cluster-marker').filter({ has: page.locator('.spot-cluster__badge') });
  await expect(cluster.first()).toBeVisible({ timeout: 15_000 });
  // Each tap zooms in until the cluster splits; a few taps reach the single pins.
  for (let i = 0; i < 5 && (await page.locator('.spot-marker .spot-pin[data-variant="pending"]').count()) === 0; i++) {
    const next = page.locator('.spot-cluster-marker').filter({ has: page.locator('.spot-cluster__badge') }).first();
    if (await next.count()) await next.click();
    await page.waitForTimeout(1200);
  }
  await expect(page.locator('.spot-marker .spot-pin[data-variant="pending"]').first()).toBeVisible();
});
