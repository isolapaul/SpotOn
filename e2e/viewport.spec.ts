import { expect } from '@playwright/test';
import { test, blockMapTiles, openApp, skipFirstRunOverlays } from './helpers';

// Design 1A: in the installed iOS app the reported viewport is one status bar short of the screen
// (iPhone 15: 805 of 852pt) and the strip below showed black. The app root must fill the real
// screen height and the dock must sit at the screen's bottom edge, not the short viewport's.

test.use({ viewport: { width: 393, height: 805 } });

test('installed iOS app: the app fills the screen and the dock sits at its bottom', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'standalone', { get: () => true });
    Object.defineProperty(screen, 'width', { get: () => 393 });
    Object.defineProperty(screen, 'height', { get: () => 852 });
  });
  await skipFirstRunOverlays(page);
  await blockMapTiles(page);
  await openApp(page);

  const root = await page.locator('main').boundingBox();
  expect(root?.height).toBe(852);
  const dock = await page.getByRole('button', { name: 'Explore', exact: true }).locator('xpath=ancestor::div[contains(@class,"absolute")][1]').boundingBox();
  // The dock's bottom edge is measured from the 852pt screen bottom, below the short viewport.
  expect((dock?.y ?? 0) + (dock?.height ?? 0)).toBeGreaterThan(805);

  // The page background is the map colour, never black.
  const bg = await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
  expect(bg).not.toBe('rgb(0, 0, 0)');
});

test('browser tab: the CSS default (100dvh) stays', async ({ page }) => {
  await skipFirstRunOverlays(page);
  await blockMapTiles(page);
  await openApp(page);
  const root = await page.locator('main').boundingBox();
  expect(root?.height).toBe(805);
});
