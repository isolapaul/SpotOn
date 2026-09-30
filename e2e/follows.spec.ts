import { expect, type Page } from '@playwright/test';
import { adminDb } from './adminDb';
import { E2E } from './fixtures';
import { test, blockMapTiles, openApp, signInWithEmail, skipFirstRunOverlays } from './helpers';

// Item 8: people search, public follow and unfollow, a private profile with a follow request that
// the other user accepts, and the own bio. Needs the functions emulator (the follow callables).
// Resets every follow, request, counter, bio and privacy flag it touches.

test.describe.configure({ mode: 'serial' });

const PEOPLE = [E2E.user.uid, E2E.admin.uid, E2E.level5.uid];

async function reset() {
  const db = adminDb();
  const { FieldValue } = await import('firebase-admin/firestore');
  for (const col of ['follows', 'followRequests']) {
    const snap = await db.collection(col).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
  }
  await Promise.all(PEOPLE.map((uid) => db.doc(`publicProfiles/${uid}`).set({ followersCount: 0, followingCount: 0 }, { merge: true })));
  await db.doc(`users/${E2E.admin.uid}`).update({ profilePrivate: FieldValue.delete() });
  await db.doc(`users/${E2E.user.uid}`).update({ bio: FieldValue.delete() });
}
test.beforeAll(reset);
test.afterAll(reset);

test.beforeEach(async ({ page }) => {
  await skipFirstRunOverlays(page);
  await blockMapTiles(page);
});

async function findPerson(page: Page, prefix: string, username: string) {
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByRole('radio', { name: 'People' }).click();
  await page.getByRole('searchbox', { name: 'Search' }).fill(prefix);
  await page.getByRole('button', { name: new RegExp(`^${username}`) }).click();
  await expect(page.getByRole('heading', { name: username })).toBeVisible();
}

// A profile's spot card (the map pin has the same name, but no text).
const spotCard = (page: Page, name: string) => page.locator('button').filter({ hasText: name });

const followDoc = (a: string, b: string) => adminDb().doc(`follows/${a}_${b}`);

test('people search, then follow and unfollow a public profile', async ({ page }) => {
  await openApp(page);
  await signInWithEmail(page, E2E.user.email, E2E.password);
  await findPerson(page, 'e2e_lev', E2E.level5.username);
  // A public profile: their approved spots are listed.
  await expect(spotCard(page, E2E.level5.approvedSpot.name)).toBeVisible();

  await page.getByRole('button', { name: 'Follow', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Unfollow' })).toBeVisible();
  await expect.poll(async () => (await followDoc(E2E.user.uid, E2E.level5.uid).get()).exists).toBe(true);
  await expect.poll(async () => (await adminDb().doc(`publicProfiles/${E2E.level5.uid}`).get()).get('followersCount')).toBe(1);

  await page.getByRole('button', { name: 'Unfollow' }).click();
  await expect(page.getByRole('button', { name: 'Follow', exact: true })).toBeVisible();
  await expect.poll(async () => (await followDoc(E2E.user.uid, E2E.level5.uid).get()).exists).toBe(false);
});

test('a private profile: request, the owner accepts in the notification centre, then the spots show', async ({ page, browser }) => {
  await adminDb().doc(`users/${E2E.admin.uid}`).update({ profilePrivate: true });
  await openApp(page);
  await signInWithEmail(page, E2E.user.email, E2E.password);
  await findPerson(page, 'e2e_adm', E2E.admin.username);
  await expect(page.getByText('This profile is private')).toBeVisible();
  await expect(spotCard(page, E2E.detailsSpot.name)).toHaveCount(0);
  await page.getByRole('button', { name: 'Request to follow' }).click();
  await expect(page.getByRole('button', { name: 'Cancel request' })).toBeVisible();

  const owner = await (await browser.newContext({ locale: 'en-US' })).newPage();
  await skipFirstRunOverlays(owner);
  await blockMapTiles(owner);
  await openApp(owner);
  await signInWithEmail(owner, E2E.admin.email, E2E.password);
  await owner.getByRole('button', { name: 'Notifications' }).click();
  await expect(owner.getByText('Follow requests')).toBeVisible();
  await owner.getByRole('button', { name: `Accept ${E2E.user.username}` }).click();
  await expect.poll(async () => (await followDoc(E2E.user.uid, E2E.admin.uid).get()).exists).toBe(true);
  await owner.context().close();

  // The requester sees the spots now: back from the profile returns to the Explore search, where
  // the result is still listed; open it again.
  await page.goBack();
  await expect(page.getByRole('searchbox', { name: 'Search' })).toHaveValue('e2e_adm');
  await page.getByRole('button', { name: new RegExp(`^${E2E.admin.username}`) }).click();
  await expect(spotCard(page, E2E.detailsSpot.name)).toBeVisible();
  await expect(page.getByText('This profile is private')).toHaveCount(0);
});

test('the own bio is saved and shown on the public profile mirror', async ({ page }) => {
  await openApp(page);
  await signInWithEmail(page, E2E.user.email, E2E.password);
  await page.getByRole('button', { name: 'Profile' }).click();
  await page.getByRole('button', { name: 'Add a bio' }).click();
  await page.getByRole('textbox', { name: 'Bio' }).fill('Sunsets and quiet benches.');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sunsets and quiet benches.' })).toBeVisible();
  await expect.poll(async () => (await adminDb().doc(`publicProfiles/${E2E.user.uid}`).get()).get('bio'), { timeout: 20_000 })
    .toBe('Sunsets and quiet benches.');
});
