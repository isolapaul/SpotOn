import { expect } from '@playwright/test';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from './adminDb';
import { E2E } from './fixtures';
import { test, blockMapTiles, openApp, signInWithEmail, skipFirstRunOverlays } from './helpers';

// Item 5: XP follows the spots. Approving a spot with a photo gives its owner 10 + 3 XP, a review
// gives the reviewer 2 XP, and deleting the spot takes both back; the owner's profile shows it
// live. Needs the functions emulator (syncXp). The spot is created here and removed afterwards.

const SPOT = { id: `e2e-xp-${Date.now().toString(36)}`, name: 'E2E XP Spot' };

const xpOf = async (uid: string) => ((await adminDb().doc(`publicProfiles/${uid}`).get()).get('xp') as number | undefined) ?? 0;

test.beforeEach(async ({ page }) => {
  await skipFirstRunOverlays(page);
  await blockMapTiles(page);
});
test.afterAll(async () => { await adminDb().doc(`spots/${SPOT.id}`).delete(); });

test('approving, reviewing and deleting a spot moves XP, live in the profile', async ({ page }) => {
  const db = adminDb();
  const [ownerXp, reviewerXp] = [await xpOf(E2E.user.uid), await xpOf(E2E.level5.uid)];

  await openApp(page);
  await signInWithEmail(page, E2E.user.email, E2E.password);
  await page.getByRole('button', { name: 'Profile' }).click();
  const xpLine = (xp: number) => page.getByText(new RegExp(`^${xp} XP · `));
  await expect(xpLine(ownerXp)).toBeVisible();

  await db.doc(`spots/${SPOT.id}`).set({
    name: SPOT.name, category: 'other', description: 'xp fixture', location: { lat: 47.53, lng: 19.09 },
    createdBy: E2E.user.uid, createdByName: E2E.user.username, createdAt: Timestamp.now(),
    imageUrls: ['/icon-192x192.png'], reviews: [], status: 'approved',
  });
  await expect(xpLine(ownerXp + 13)).toBeVisible({ timeout: 20_000 });

  await db.doc(`spots/${SPOT.id}`).update({
    reviews: [{ id: `${E2E.level5.uid}_1`, userId: E2E.level5.uid, userName: E2E.level5.username, rating: 5, comment: '', createdAt: Timestamp.now() }],
  });
  await expect.poll(() => xpOf(E2E.level5.uid), { timeout: 20_000 }).toBe(reviewerXp + 2);
  expect((await db.doc(`spots/${SPOT.id}`).get()).get('contributors')).toEqual([E2E.level5.uid]);

  await db.doc(`spots/${SPOT.id}`).delete();
  await expect(xpLine(ownerXp)).toBeVisible({ timeout: 20_000 });
  await expect.poll(() => xpOf(E2E.level5.uid), { timeout: 20_000 }).toBe(reviewerXp);
});
