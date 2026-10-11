import { expect } from '@playwright/test';
import { E2E } from './fixtures';
import { test, blockMapTiles, openApp, skipFirstRunOverlays, spotMarker } from './helpers';

// Growth plan §6: "Share as image" draws the story card; without Web Share for files (desktop
// Chromium) it downloads a 1080×1920 PNG.

test.beforeEach(async ({ page }) => {
  await skipFirstRunOverlays(page);
  await blockMapTiles(page);
});

test('the spot page shares its story card as an image', async ({ page }) => {
  await openApp(page);
  await spotMarker(page, E2E.legacySpot.category).click();
  await page.getByRole('button', { name: 'View Details' }).click();
  await page.getByRole('button', { name: 'More actions', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Share as image' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe(`spoton-${E2E.legacySpot.id}.png`);
  const path = await file.path();
  const { readFileSync } = await import('node:fs');
  const png = readFileSync(path);
  // PNG header, then the IHDR width and height.
  expect(png.subarray(1, 4).toString()).toBe('PNG');
  expect(png.readUInt32BE(16)).toBe(1080);
  expect(png.readUInt32BE(20)).toBe(1920);
});
