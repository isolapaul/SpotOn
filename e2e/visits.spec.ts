import { expect } from '@playwright/test';
import { adminDb } from './adminDb';
import { E2E } from './fixtures';
import { test, blockMapTiles, openApp, signInWithEmail, skipFirstRunOverlays, spotMarker } from './helpers';

// Growth plan §4: "I was here" checks the device position against the spot (markVisited: needs the
// functions emulator) and the profile shows the stamp. Removes the visit and its counter after.

test.describe.configure({ mode: 'serial' });

/** The legacy spot's position (scripts/seed-emulator.ts). */
const AT_SPOT = { latitude: 47.5009, longitude: 19.0452, accuracy: 10 };
const FAR_AWAY = { latitude: 47.6, longitude: 19.2, accuracy: 10 };

async function reset() {
  const db = adminDb();
  await db.doc(`users/${E2E.user.uid}/visits/${E2E.legacySpot.id}`).delete();
  await db.doc(`spotStats/${E2E.legacySpot.id}`).delete();
  await db.doc(`rateLimits/${E2E.user.uid}`).delete();
}
test.beforeAll(reset);
test.afterAll(reset);

test.beforeEach(async ({ page }) => {
  await skipFirstRunOverlays(page);
  await blockMapTiles(page);
});

async function openLegacySpot(page: import('@playwright/test').Page) {
  await openApp(page);
  await signInWithEmail(page, E2E.user.email, E2E.password);
  await spotMarker(page, E2E.legacySpot.category).click();
  await page.getByRole('button', { name: 'View Details' }).click();
}

test('far from the spot, "I was here" explains the distance', async ({ page, context }) => {
  // Permission only now: at startup the map would fly to the far position and away from the pin.
  await openLegacySpot(page);
  await context.setGeolocation(FAR_AWAY);
  await context.grantPermissions(['geolocation']);
  await page.getByRole('button', { name: 'I was here' }).click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('spoton-notifications') ?? '')).toContain('within 300 m');
  await expect(page.getByText('You were here')).toHaveCount(0);
});

test('at the spot, "I was here" stamps it and the profile counts the stamp', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation(AT_SPOT);
  await openLegacySpot(page);
  await page.getByRole('button', { name: 'I was here' }).click();
  await expect(page.getByText('You were here')).toBeVisible();
  await expect.poll(async () => (await adminDb().doc(`users/${E2E.user.uid}/visits/${E2E.legacySpot.id}`).get()).exists).toBe(true);
  await page.goto('/');
  await expect(page.getByTestId('loading-screen')).toHaveCount(0, { timeout: 30_000 });
  await page.getByRole('button', { name: 'Profile' }).click();
  await page.getByRole('button', { name: 'Stamps (1)' }).click();
  await expect(page.getByRole('dialog', { name: 'My stamps (1)' }).getByText(E2E.legacySpot.name)).toBeVisible();
});
