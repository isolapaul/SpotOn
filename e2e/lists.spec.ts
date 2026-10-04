import { expect, type Page } from '@playwright/test';
import { adminDb } from './adminDb';
import { E2E } from './fixtures';
import { test, blockMapTiles, expectNotification, openApp, signInWithEmail, skipFirstRunOverlays, spotMarker } from './helpers';

// Own spot lists: save a spot to a new list, open it from Favorites, show it on the profile, where
// another user sees it; and Explore's "New this week" chip. Needs the functions emulator (getProfile).
// Removes every list of `user` before and after.

test.describe.configure({ mode: 'serial' });

const LIST = 'Golden hour';

async function reset() {
  const snap = await adminDb().collection(`users/${E2E.user.uid}/lists`).get();
  await Promise.all(snap.docs.map((d) => d.ref.delete()));
}
test.beforeAll(reset);
test.afterAll(reset);

test.beforeEach(async ({ page }) => {
  await skipFirstRunOverlays(page);
  await blockMapTiles(page);
});

// A profile's spot card (the map pin has the same name, but no text).
const spotCard = (page: Page, name: string) => page.locator('button').filter({ hasText: name });

test('save a spot to a new list, share it on the profile, another user sees it', async ({ page, browser }) => {
  await openApp(page);
  await signInWithEmail(page, E2E.user.email, E2E.password);

  // 1. From the spot's details: More → Save to list → a new list with this spot in it
  await spotMarker(page, E2E.legacySpot.category).click();
  await page.getByRole('button', { name: 'View Details' }).click();
  await page.getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('button', { name: 'Save to list' }).click();
  await expect(page.getByRole('heading', { name: 'Save to list' })).toBeVisible();
  await page.getByRole('textbox', { name: 'New list name' }).fill(LIST);
  await page.getByRole('button', { name: 'Create list' }).click();
  await expectNotification(page, 'List created');
  await expect(page.getByRole('checkbox', { name: new RegExp(LIST) })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('button', { name: 'Done' }).click();
  await expect.poll(async () => {
    const snap = await adminDb().collection(`users/${E2E.user.uid}/lists`).get();
    return snap.docs.map((d) => [d.get('name'), d.get('spotIds')]);
  }).toEqual([[LIST, [E2E.legacySpot.id]]]);

  // 2. Profile → Favorites: the list card opens the list with the spot; share it
  await page.goto('/');
  await openApp(page);
  await page.getByRole('button', { name: 'Profile' }).click();
  await page.getByRole('button', { name: 'Favorites', exact: true }).click();
  await page.getByRole('button', { name: new RegExp(`^${LIST}`) }).click();
  await expect(page.getByRole('heading', { name: LIST })).toBeVisible();
  await expect(spotCard(page, E2E.legacySpot.name)).toBeVisible();
  const share = page.getByRole('switch', { name: 'Show on my profile' });
  await share.click();
  await expect(share).toHaveAttribute('aria-checked', 'true');
  await expect.poll(async () => {
    const snap = await adminDb().collection(`users/${E2E.user.uid}/lists`).where('shared', '==', true).get();
    return snap.size;
  }).toBe(1);

  // 3. Another user finds the profile: a Lists tab with the list, read-only
  const other = await (await browser.newContext({ locale: 'en-US' })).newPage();
  await skipFirstRunOverlays(other);
  await blockMapTiles(other);
  await openApp(other);
  await signInWithEmail(other, E2E.admin.email, E2E.password);
  await other.getByRole('button', { name: 'Explore', exact: true }).click();
  await other.getByRole('button', { name: 'Search', exact: true }).click();
  await other.getByRole('radio', { name: 'People' }).click();
  await other.getByRole('searchbox', { name: 'Search' }).fill('e2e_us');
  await other.getByRole('button', { name: new RegExp(`^${E2E.user.username}`) }).click();
  await other.getByRole('tab', { name: 'Lists' }).click();
  await other.getByRole('button', { name: new RegExp(`^${LIST}`) }).click();
  await expect(spotCard(other, E2E.legacySpot.name)).toBeVisible();
  await expect(other.getByRole('button', { name: 'Delete list' })).toHaveCount(0);
  await expect(other.getByText('Remove from list')).toHaveCount(0);
  await other.context().close();

  // 4. The owner removes the spot, then deletes the list
  await spotCard(page, E2E.legacySpot.name).getByText('Remove from list').click();
  await expect(page.getByText('This list is empty.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Delete list' }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByRole('heading', { name: LIST })).toHaveCount(0);
  await expect.poll(async () => (await adminDb().collection(`users/${E2E.user.uid}/lists`).get()).size).toBe(0);
});

test('Explore: "New this week" shows only spots approved in the last 7 days', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  const chip = page.getByRole('button', { name: /New this week/ });
  await expect(chip).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByText(E2E.legacySpot.name, { exact: true })).toBeVisible();

  await chip.click();
  await expect(chip).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText(E2E.modernSpot.name, { exact: true })).toBeVisible();
  await expect(page.getByText(E2E.legacySpot.name, { exact: true })).toHaveCount(0);

  await chip.click();
  await expect(page.getByText(E2E.legacySpot.name, { exact: true })).toBeVisible();
});
