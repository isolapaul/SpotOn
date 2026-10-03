import { expect, type Page } from '@playwright/test';
import { E2E } from './fixtures';
import { test, blockMapTiles, openApp, signInWithEmail, skipFirstRunOverlays } from './helpers';

// Item 3: spots open from the profile (fly to the spot, place card with a way back) and from Explore
// (closing returns to Explore); the system back steps back inside the app. Read-only.

const profileOpen = (page: Page) => page.getByRole('button', { name: 'Close profile panel' });
const exploreOpen = (page: Page) => page.getByRole('button', { name: 'Close discovery panel' });
/** Taps during a view transition hit its overlay, not the page: wait until it has finished. */
const settled = (page: Page) => page.waitForFunction(() => !document.documentElement.dataset.vt);
const placeCard = (page: Page, name: string) => page.getByRole('region', { name });
/** A spot card in the profile (the map pin has the same name, as a marker). */
const profileCard = (page: Page, name: string) => page.locator(`button[aria-label="${name}"]`);

test.beforeEach(async ({ page }) => {
  await skipFirstRunOverlays(page);
  await blockMapTiles(page);
  await openApp(page);
  await signInWithEmail(page, E2E.user.email, E2E.password);
});

async function openOwnSpotFromProfile(page: Page) {
  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  await expect(profileOpen(page)).toBeAttached();
  await profileCard(page, E2E.modernSpot.name).click();
  await expect(profileOpen(page)).toHaveCount(0);
  // The card opens once the map has flown to the spot; its pin is the selected one.
  await expect(placeCard(page, E2E.modernSpot.name)).toBeVisible();
  await expect(page.locator(`.spot-pin[data-category="${E2E.modernSpot.category}"][data-selected="true"]`)).toHaveCount(1);
}

test('profile: a spot card flies to the spot, and the back capsule returns to the profile', async ({ page }) => {
  await openOwnSpotFromProfile(page);
  await placeCard(page, E2E.modernSpot.name).getByRole('button', { name: 'Back to profile', exact: true }).click();
  await expect(profileOpen(page)).toBeAttached();
  await expect(placeCard(page, E2E.modernSpot.name)).toHaveCount(0);
});

test('profile: closing the card stays on the map; details keep the way back', async ({ page }) => {
  await openOwnSpotFromProfile(page);
  await placeCard(page, E2E.modernSpot.name).getByRole('button', { name: 'Details', exact: true }).click();
  await expect(page.getByRole('heading', { name: E2E.modernSpot.name })).toBeVisible();
  await settled(page);
  await page.getByRole('button', { name: 'Back to profile', exact: true }).first().click();
  await expect(profileOpen(page)).toBeAttached();

  await profileCard(page, E2E.modernSpot.name).click();
  await expect(placeCard(page, E2E.modernSpot.name)).toBeVisible();
  await placeCard(page, E2E.modernSpot.name).getByRole('button', { name: 'Close', exact: true }).click();
  await expect(placeCard(page, E2E.modernSpot.name)).toHaveCount(0);
  await expect(profileOpen(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Explore', exact: true })).toBeVisible();
});

test('the system back steps back: card → profile → map', async ({ page }) => {
  await openOwnSpotFromProfile(page);
  await page.goBack();
  await expect(profileOpen(page)).toBeAttached();
  await page.goBack();
  await expect(profileOpen(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Explore', exact: true })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/');
});

test('Explore: closing a spot or going back returns to Explore with the same filter', async ({ page }) => {
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  const parkChip = page.getByRole('button', { name: 'Park', exact: true });
  await parkChip.click();
  await expect(parkChip).toHaveAttribute('aria-pressed', 'true');

  await page.locator('button').filter({ hasText: E2E.modernSpot.name }).first().click();
  await expect(page.getByRole('heading', { name: E2E.modernSpot.name })).toBeVisible();
  await expect(exploreOpen(page)).toHaveCount(0);
  await settled(page);
  await page.getByRole('button', { name: 'Back to Explore', exact: true }).first().click();
  await expect(exploreOpen(page)).toBeAttached();
  await expect(page.getByRole('button', { name: 'Park', exact: true })).toHaveAttribute('aria-pressed', 'true');

  await page.locator('button').filter({ hasText: E2E.modernSpot.name }).first().click();
  await expect(page.getByRole('heading', { name: E2E.modernSpot.name })).toBeVisible();
  await page.goBack();
  await expect(exploreOpen(page)).toBeAttached();
});
