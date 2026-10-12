import { expect } from '@playwright/test';
import { adminDb } from './adminDb';
import { E2E } from './fixtures';
import { test, blockMapTiles, openApp, signInWithEmail, skipFirstRunOverlays, spotMarker } from './helpers';

// Growth plan §5: with config/app.lockEnabled (and no place kept open by popularity), a signed-out
// visitor sees the pins but a locked card; the owner of a spot (a contributor) sees everything.
// Removes config/app afterwards.

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  await adminDb().doc('config/app').set({ lockEnabled: true, lockOpenCount: 0 });
});
test.afterAll(async () => {
  await adminDb().doc('config/app').delete();
});

test.beforeEach(async ({ page }) => {
  await skipFirstRunOverlays(page);
  await blockMapTiles(page);
});

test('signed out: a locked pin shows a hidden place with what unlocks it', async ({ page }) => {
  await openApp(page);
  const pin = spotMarker(page, E2E.legacySpot.category);
  await expect(pin).toHaveAttribute('data-locked', 'true');
  await expect(pin).toHaveAttribute('aria-label', 'Hidden place');
  await pin.click();
  const card = page.getByRole('region', { name: 'Hidden place' });
  await expect(card.getByText('Share your first spot or invite a friend, and every place opens up.')).toBeVisible();
  await expect(card.getByText(E2E.legacySpot.name)).toHaveCount(0);
  await expect(card.getByRole('button', { name: 'Add a spot' })).toBeVisible();
});

test('a contributor sees every place', async ({ page }) => {
  await openApp(page);
  await signInWithEmail(page, E2E.user.email, E2E.password);
  const pin = spotMarker(page, E2E.legacySpot.category);
  await expect(pin).not.toHaveAttribute('data-locked', 'true');
  await pin.click();
  await expect(page.getByRole('region', { name: E2E.legacySpot.name })).toBeVisible();
});
