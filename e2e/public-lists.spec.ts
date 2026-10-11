import { expect } from '@playwright/test';
import { adminDb } from './adminDb';
import { E2E } from './fixtures';
import { test, blockMapTiles, openApp, skipFirstRunOverlays } from './helpers';

// Growth plan §7: a public list has a server-rendered web page, shows up in Explore's list search
// and opens in its sheet. Creates its own list and removes it.

const LIST_ID = 'e2e-public-list';
const NAME = 'E2E Panorama Picks';

test.beforeAll(async () => {
  const { Timestamp } = await import('firebase-admin/firestore');
  await adminDb().doc(`users/${E2E.user.uid}/lists/${LIST_ID}`).set({
    name: NAME, nameLower: NAME.toLowerCase(), spotIds: [E2E.legacySpot.id], shared: true, public: true,
    createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
  });
  // The owner's public name (the functions emulator's mirror sets the same value).
  await adminDb().doc(`publicProfiles/${E2E.user.uid}`).set({ username: E2E.user.username }, { merge: true });
});
test.afterAll(async () => {
  await adminDb().doc(`users/${E2E.user.uid}/lists/${LIST_ID}`).delete();
});

test.beforeEach(async ({ page }) => {
  await skipFirstRunOverlays(page);
  await blockMapTiles(page);
});

test('the public list has its own web page', async ({ page }) => {
  await page.goto(`/list/${E2E.user.uid}/${LIST_ID}`);
  await expect(page.getByRole('heading', { name: NAME })).toBeVisible();
  await expect(page.getByText(`A list by @${E2E.user.username}`).or(page.getByText(`@${E2E.user.username} listája`))).toBeVisible();
  await expect(page.getByRole('link', { name: new RegExp(E2E.legacySpot.name) })).toHaveAttribute('href', `/spot/${E2E.legacySpot.id}`);
  await expect(page).toHaveTitle(`${NAME} · SpotOn`);
});

test('Explore finds the public list and opens it', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByRole('radio', { name: 'Lists' }).click();
  await page.getByRole('searchbox', { name: 'Search' }).fill('e2e pano');
  await page.getByRole('button', { name: new RegExp(NAME) }).click();
  const sheet = page.getByRole('dialog', { name: NAME });
  await expect(sheet.getByText(`@${E2E.user.username}`)).toBeVisible();
  await expect(sheet.getByText(E2E.legacySpot.name)).toBeVisible();
});

test('the sitemap lists the public list', async ({ request }) => {
  const res = await request.get('/sitemap.xml');
  expect(res.ok()).toBe(true);
  expect(res.headers()['content-type']).toContain('application/xml');
});
