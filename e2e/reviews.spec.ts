import { expect } from '@playwright/test';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from './adminDb';
import { E2E } from './fixtures';
import { test, blockMapTiles, openApp, signInWithEmail, skipFirstRunOverlays } from './helpers';

// Own reviews can be edited and deleted; anyone signed in replies (questions too), and the review's
// author hears about it. Needs the functions emulator. Creates and removes its own spot.

test.describe.configure({ mode: 'serial' });
const SPOT = { id: `e2e-reviews-${Date.now().toString(36)}`, name: 'E2E Reviews Spot' };
const REVIEW_ID = `${E2E.user.uid}_1`;

async function cleanup() {
  const db = adminDb();
  const replies = await db.collection(`spots/${SPOT.id}/replies`).get();
  await Promise.all(replies.docs.map((d) => d.ref.delete()));
  await db.doc(`spots/${SPOT.id}`).delete();
}
test.beforeAll(async () => {
  await cleanup();
  await adminDb().doc(`spots/${SPOT.id}`).set({
    name: SPOT.name, category: 'other', description: 'reviews fixture', location: { lat: 47.512, lng: 19.058 },
    createdBy: E2E.admin.uid, createdByName: E2E.admin.username, createdAt: Timestamp.now(),
    imageUrls: ['/placeholder-spot.jpg'], status: 'approved',
    reviews: [{ id: REVIEW_ID, userId: E2E.user.uid, userName: E2E.user.username, rating: 3, comment: 'Nice bench', createdAt: Timestamp.now() }],
  });
});
test.afterAll(cleanup);
test.beforeEach(async ({ page }) => {
  await skipFirstRunOverlays(page);
  await blockMapTiles(page);
});

const reviews = async () => (await adminDb().doc(`spots/${SPOT.id}`).get()).get('reviews') as Array<{ rating: number; comment: string }>;

async function openSpot(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  await page.locator('button').filter({ hasText: SPOT.name }).first().click();
}

test('someone asks a question under a review; the author answers and edits the review', async ({ page, browser }) => {
  const other = await (await browser.newContext({ locale: 'en-US' })).newPage();
  await skipFirstRunOverlays(other);
  await blockMapTiles(other);
  await openApp(other);
  await signInWithEmail(other, E2E.level5.email, E2E.password);
  await openSpot(other);
  await other.getByRole('button', { name: 'Reply' }).click();
  await other.getByRole('textbox', { name: 'Reply or ask a question…' }).fill('Is it in the shade?');
  await other.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(other.getByRole('listitem').getByText('Is it in the shade?')).toBeVisible();
  await other.context().close();

  await openApp(page);
  await signInWithEmail(page, E2E.user.email, E2E.password);
  await openSpot(page);
  await expect(page.getByRole('listitem').getByText('Is it in the shade?')).toBeVisible();
  await page.getByRole('button', { name: 'Reply' }).click();
  await page.getByRole('textbox', { name: 'Reply or ask a question…' }).fill('Yes, after 3 pm');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByRole('listitem').getByText('Yes, after 3 pm')).toBeVisible();

  await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
  await page.getByRole('textbox', { name: 'Comment' }).fill('Nice bench, shady after 3');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect.poll(async () => (await reviews())[0]?.comment).toBe('Nice bench, shady after 3');
  await expect(page.getByText('edited', { exact: false }).first()).toBeVisible();
});

test('the author deletes the review with its replies', async ({ page }) => {
  await openApp(page);
  await signInWithEmail(page, E2E.user.email, E2E.password);
  await openSpot(page);
  await page.locator('article').getByRole('button', { name: 'Delete', exact: true }).first().click();
  await page.locator('div.rounded-xl').filter({ hasText: 'Delete your review?' }).getByRole('button', { name: 'Delete', exact: true }).click();
  await expect.poll(async () => (await reviews()).length).toBe(0);
  await expect.poll(async () => (await adminDb().collection(`spots/${SPOT.id}/replies`).get()).size).toBe(0);
});
