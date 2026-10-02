import { expect } from '@playwright/test';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from './adminDb';
import { E2E } from './fixtures';
import { test, blockMapTiles, openApp, signInWithEmail, skipFirstRunOverlays } from './helpers';

// Reports and blocks (Play UGC): a user reports a review, an admin removes it with a reason from the
// reports queue; a user blocks someone, who then cannot open their profile. Needs the functions
// emulator. Creates its own spot and cleans up every report and block.

test.describe.configure({ mode: 'serial' });

const SPOT = { id: `e2e-safety-${Date.now().toString(36)}`, name: 'E2E Safety Spot' };
const REVIEW_ID = `${E2E.level5.uid}_1`;

async function cleanup() {
  const db = adminDb();
  await db.doc(`spots/${SPOT.id}`).delete();
  for (const col of ['reports', 'blocks', 'follows', 'followRequests']) {
    const snap = await db.collection(col).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
  }
}
test.beforeAll(async () => {
  await cleanup();
  await adminDb().doc(`spots/${SPOT.id}`).set({
    name: SPOT.name, category: 'other', description: 'safety fixture', location: { lat: 47.515, lng: 19.06 },
    createdBy: E2E.admin.uid, createdByName: E2E.admin.username, createdAt: Timestamp.now(),
    imageUrls: ['/placeholder-spot.jpg'], status: 'approved',
    reviews: [{ id: REVIEW_ID, userId: E2E.level5.uid, userName: E2E.level5.username, rating: 1, comment: 'Buy cheap pills here', createdAt: Timestamp.now() }],
  });
});
test.afterAll(cleanup);

test.beforeEach(async ({ page }) => {
  await skipFirstRunOverlays(page);
  await blockMapTiles(page);
});

test('a reported review is removed by an admin with a reason', async ({ page, browser }) => {
  await openApp(page);
  await signInWithEmail(page, E2E.user.email, E2E.password);
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  await page.locator('button').filter({ hasText: SPOT.name }).first().click();
  await page.getByRole('button', { name: 'Report' }).first().click();
  await page.getByRole('radio', { name: 'Spam or advertising' }).click();
  await page.getByRole('button', { name: 'Send report' }).click();
  await expect.poll(async () => (await adminDb().collection('reports').get()).size).toBe(1);

  const admin = await (await browser.newContext({ locale: 'en-US' })).newPage();
  await skipFirstRunOverlays(admin);
  await blockMapTiles(admin);
  await openApp(admin);
  await signInWithEmail(admin, E2E.admin.email, E2E.password);
  await admin.getByRole('button', { name: 'Profile' }).click();
  await admin.getByRole('button', { name: /Pending Approval/ }).click();
  await admin.getByRole('radio', { name: /Reports/ }).click();
  await expect(admin.getByText('Buy cheap pills here')).toBeVisible();
  await admin.getByRole('button', { name: 'Remove content' }).click();
  await admin.locator('#moderation-reason').fill('Spam');
  await admin.getByRole('dialog').getByRole('button', { name: 'Remove content' }).click();
  await expect.poll(async () => ((await adminDb().doc(`spots/${SPOT.id}`).get()).get('reviews') as unknown[]).length).toBe(0);
  await expect.poll(async () => (await adminDb().collection('reports').get()).size).toBe(0);
  await admin.context().close();
});

test('a blocked user cannot open the blocker\'s profile', async ({ page, browser }) => {
  await openApp(page);
  await signInWithEmail(page, E2E.user.email, E2E.password);
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByRole('radio', { name: 'People' }).click();
  await page.getByRole('searchbox', { name: 'Search' }).fill('e2e_lev');
  await page.getByRole('button', { name: /^e2e_level5/ }).click();
  await page.getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('menuitem', { name: 'Block' }).click();
  await page.getByRole('button', { name: 'Block', exact: true }).click();
  await expect(page.getByText('You blocked this user.')).toBeVisible();
  await expect.poll(async () => (await adminDb().doc(`blocks/${E2E.user.uid}_${E2E.level5.uid}`).get()).exists).toBe(true);

  const other = await (await browser.newContext({ locale: 'en-US' })).newPage();
  await skipFirstRunOverlays(other);
  await blockMapTiles(other);
  await openApp(other);
  await signInWithEmail(other, E2E.level5.email, E2E.password);
  await other.getByRole('button', { name: 'Explore', exact: true }).click();
  await other.getByRole('button', { name: 'Search', exact: true }).click();
  await other.getByRole('radio', { name: 'People' }).click();
  await other.getByRole('searchbox', { name: 'Search' }).fill('e2e_us');
  await expect(other.getByText('No such user.')).toBeVisible();
  await other.context().close();
});
