import { expect } from '@playwright/test';
import { adminDb } from './adminDb';
import { E2E } from './fixtures';
import { test, blockMapTiles, openApp, signInWithEmail, skipFirstRunOverlays } from './helpers';

// Item 6: from level 4 a user picks one icon for the pins of all their spots. Needs the functions
// emulator (updatePinIcon, syncXp). Resets the level5 user's choice before and after.

async function reset() {
  const db = adminDb();
  const { FieldValue } = await import('firebase-admin/firestore');
  await db.doc(`users/${E2E.level5.uid}`).update({ pinIcon: FieldValue.delete() });
  const spots = await db.collection('spots').where('createdBy', '==', E2E.level5.uid).get();
  await Promise.all(spots.docs.map((d) => d.ref.update({ ownerPin: FieldValue.delete() })));
}

test.beforeAll(reset);
test.afterAll(reset);

test.beforeEach(async ({ page }) => {
  await skipFirstRunOverlays(page);
  await blockMapTiles(page);
});

test('a level-5 user puts a crown on all their pins, then goes back to the category icons', async ({ page }) => {
  await openApp(page);
  await signInWithEmail(page, E2E.level5.email, E2E.password);
  const crowned = page.locator('.spot-pin[data-pin="crown"]');
  await expect(crowned).toHaveCount(0);

  await page.getByRole('button', { name: 'Profile' }).click();
  await page.getByRole('button', { name: 'Pin style' }).click();
  await page.getByRole('button', { name: 'Crown' }).click();
  await expect(page.getByRole('button', { name: 'Crown' })).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => {
    const spots = await adminDb().collection('spots').where('createdBy', '==', E2E.level5.uid).get();
    return spots.docs.filter((d) => d.get('ownerPin') === 'crown').length;
  }, { timeout: 20_000 }).toBe(20);

  // The map shows it on the owner's pins (their pending ones too).
  await page.goBack();
  await expect.poll(() => crowned.count(), { timeout: 20_000 }).toBeGreaterThan(0);

  await page.getByRole('button', { name: 'Profile' }).click();
  await page.getByRole('button', { name: 'Pin style' }).click();
  await page.getByRole('button', { name: 'Category', exact: true }).click();
  await expect.poll(async () => {
    const spots = await adminDb().collection('spots').where('createdBy', '==', E2E.level5.uid).get();
    return spots.docs.filter((d) => d.get('ownerPin') !== undefined).length;
  }, { timeout: 20_000 }).toBe(0);
});
