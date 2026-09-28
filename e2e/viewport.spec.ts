import { expect } from '@playwright/test';
import { test, blockMapTiles, openApp, skipFirstRunOverlays } from './helpers';

// Design 1A: the installed iOS app showed a band below the map. With the translucent status bar,
// iOS 26 sizes the page one status bar short and no CSS reaches the strip below (WebKit bug
// 301108), so the app asks for the opaque status bar and simply fills the viewport.

test.use({ viewport: { width: 393, height: 805 } });

test('the app fills the viewport, the dock sits inside it, and the status bar is opaque', async ({ page }) => {
  await skipFirstRunOverlays(page);
  await blockMapTiles(page);
  await openApp(page);

  await expect(page.locator('meta[name="apple-mobile-web-app-status-bar-style"]')).toHaveAttribute('content', 'black');

  const root = await page.locator('main').boundingBox();
  expect(root?.y).toBe(0);
  expect(root?.height).toBe(805);
  const dock = await page.getByRole('button', { name: 'Explore', exact: true }).locator('xpath=ancestor::div[contains(@class,"absolute")][1]').boundingBox();
  expect((dock?.y ?? 0) + (dock?.height ?? 0)).toBeLessThanOrEqual(805);

  // The page background is the map colour, never black.
  const bg = await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
  expect(bg).not.toBe('rgb(0, 0, 0)');
});
