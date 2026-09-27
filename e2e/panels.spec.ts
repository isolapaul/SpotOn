import { expect, type Page } from '@playwright/test';
import { E2E } from './fixtures';
import { test, blockMapTiles, openApp, signInWithEmail, skipFirstRunOverlays } from './helpers';

// T29: the panel state machine (activePanel in useUiStore) and the add-spot location selection.
// Read-only: the add form is closed without submitting, so no fixture is changed. Tiles are
// aborted by blockMapTiles, so tile checks assert DOM presence only (never visibility or load).

const satelliteTile = (page: Page) => page.locator('img.leaflet-tile[src*="arcgisonline"]');
const standardTile = (page: Page) => page.locator('img.leaflet-tile[src*="tile.openstreetmap.org"]');
const clickMapBanner = (page: Page) => page.getByText('📍 Click on the map to select location', { exact: true });
const addButton = (page: Page) => page.getByRole('button', { name: 'Add', exact: true });

test.beforeEach(async ({ page }) => {
  await skipFirstRunOverlays(page, 'en');
  await blockMapTiles(page);
  // The signed-in NotificationPrompt (z-50) would otherwise cover the Cancel button (z-10, same slot).
  await page.addInitScript(() => sessionStorage.setItem('notification-prompt-dismissed', 'true'));
});

test('add spot: one banner, satellite while selecting, theme restored on cancel and on close', async ({ page }) => {
  await openApp(page);
  await signInWithEmail(page, E2E.user.email, E2E.password);

  // 1. Selecting: exactly one "click the map" banner (DUP-15) and the satellite tiles.
  await addButton(page).click();
  await expect(clickMapBanner(page)).toHaveCount(1);
  await expect(clickMapBanner(page)).toBeVisible();
  await expect(satelliteTile(page).first()).toBeAttached();

  // 2. Cancel restores the standard map.
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(clickMapBanner(page)).toHaveCount(0);
  await expect(standardTile(page).first()).toBeAttached();
  await expect(satelliteTile(page)).toHaveCount(0);

  // 3. Pick a point away from the markers and the blue dot (both within ~80 px of the centre).
  await addButton(page).click();
  await expect(satelliteTile(page).first()).toBeAttached();
  const map = page.locator('.leaflet-container');
  const box = (await map.boundingBox())!;
  await map.click({ position: { x: box.width / 2 - 300, y: box.height / 2 + 150 } });
  await expect(page.locator('#spot-name')).toBeVisible();
  await expect(clickMapBanner(page)).toHaveCount(0);

  // Closing the add form restores the standard map.
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.locator('#spot-name')).toHaveCount(0);
  await expect(standardTile(page).first()).toBeAttached();
  await expect(satelliteTile(page)).toHaveCount(0);
});

test('explore → spot opens the details and replaces discovery', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  await expect(page.getByLabel('Close discovery panel')).toBeVisible();

  await page.getByRole('button', { name: E2E.legacySpot.name }).first().click();
  await expect(page.getByLabel('Close spot details')).toBeVisible();
  await expect(page.getByLabel('Close discovery panel')).toHaveCount(0);
});

test('signed out: profile opens the auth modal', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: 'Profile' }).click();
  await expect(page.getByRole('button', { name: 'With Email' })).toBeVisible();
  await expect(page.getByLabel('Close profile panel')).toHaveCount(0);
});
