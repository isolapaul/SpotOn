import { expect, type Page } from '@playwright/test';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from './adminDb';
import { E2E } from './fixtures';
import { test, blockMapTiles, openApp, signInWithEmail, skipFirstRunOverlays } from './helpers';

// Item 7: the super admin creates a category, renames it and changes its icon; it shows in
// Explore; it cannot be deleted while a spot uses it, then can. Needs the functions emulator
// (deleteCategory). The category and the spot are created here and removed afterwards.

const NAME = `E2E Lakes ${Date.now().toString(36)}`;
const RENAMED = `${NAME} Renamed`;
const SPOT_ID = `e2e-cat-${Date.now().toString(36)}`;

async function categoryIdByName(name: string): Promise<string | undefined> {
  return (await adminDb().collection('categories').where('name', '==', name).get()).docs[0]?.id;
}

async function cleanup() {
  const db = adminDb();
  await db.doc(`spots/${SPOT_ID}`).delete();
  for (const name of [NAME, RENAMED]) {
    const snap = await db.collection('categories').where('name', '==', name).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
  }
}
test.beforeAll(cleanup);
test.afterAll(cleanup);

test.beforeEach(async ({ page }) => {
  await skipFirstRunOverlays(page);
  await blockMapTiles(page);
});

async function openCategories(page: Page) {
  await page.getByRole('button', { name: 'Profile' }).click();
  await page.getByRole('button', { name: 'admin', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Manage Categories' })).toBeVisible();
}

test('the super admin creates, renames and deletes a category only while unused', async ({ page }) => {
  await openApp(page);
  await signInWithEmail(page, E2E.superAdmin.email, E2E.password);
  await openCategories(page);

  // Create
  const form = page.locator('div.space-y-3').filter({ has: page.getByRole('button', { name: 'Add Category' }) });
  await form.getByLabel('Name (Hungarian)').fill(NAME);
  await form.getByLabel('English (optional)').fill(`${NAME} EN`);
  await form.getByRole('radio', { name: 'Lake' }).click();
  await form.getByRole('button', { name: 'Add Category' }).click();
  await expect(page.getByText(NAME, { exact: true })).toBeVisible();
  await expect.poll(() => categoryIdByName(NAME)).toBeTruthy();
  expect((await adminDb().doc(`categories/${(await categoryIdByName(NAME))!}`).get()).get('nameEn')).toBe(`${NAME} EN`);
  const id = (await categoryIdByName(NAME))!;

  // Rename and change the icon
  await page.getByRole('button', { name: `Edit: ${NAME}` }).click();
  const editForm = page.locator('li').filter({ has: page.getByRole('button', { name: 'Save' }) });
  await editForm.getByLabel('Name (Hungarian)').fill(RENAMED);
  await editForm.getByLabel('English (optional)').fill('');
  await editForm.getByRole('radio', { name: 'Cave' }).click();
  await editForm.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText(RENAMED, { exact: true })).toBeVisible();
  await expect.poll(async () => (await adminDb().doc(`categories/${id}`).get()).data())
    .toMatchObject({ name: RENAMED, icon: 'cave' });
  expect((await adminDb().doc(`categories/${id}`).get()).get('nameEn')).toBeUndefined();

  // A spot uses it: delete is disabled, and it shows in Explore
  await adminDb().doc(`spots/${SPOT_ID}`).set({
    name: 'E2E Category Spot', category: id, description: 'category fixture', location: { lat: 47.51, lng: 19.07 },
    createdBy: E2E.user.uid, createdByName: E2E.user.username, createdAt: Timestamp.now(),
    imageUrls: ['/placeholder-spot.jpg'], reviews: [], status: 'approved',
  });
  await expect(page.getByText('Spots: 1')).toBeVisible();
  await expect(page.getByRole('button', { name: `Delete: ${RENAMED}` })).toBeDisabled();

  // Unused again: delete through the callable
  await adminDb().doc(`spots/${SPOT_ID}`).delete();
  await page.getByRole('button', { name: `Delete: ${RENAMED}` }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByText(RENAMED, { exact: true })).toHaveCount(0);
  await expect.poll(async () => (await adminDb().doc(`categories/${id}`).get()).exists).toBe(false);
});

test('a custom category is offered in Explore, in the UI language', async ({ page }) => {
  const ref = await adminDb().collection('categories').add({ name: NAME, nameEn: `${NAME} EN`, icon: 'lake', createdAt: Timestamp.now() });
  await openApp(page);
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  // The English UI shows the English name.
  await expect(page.getByRole('button', { name: `${NAME} EN`, exact: true })).toBeVisible();
  await ref.delete();
});
