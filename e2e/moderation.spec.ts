import { expect, type Page } from '@playwright/test';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from './adminDb';
import { E2E } from './fixtures';
import { test, blockMapTiles, expectNotification, openApp, signInWithEmail, skipFirstRunOverlays } from './helpers';

// Item 4: rejection with a reason and resubmission, an owner's edit proposal approved by an admin,
// removal with a reason, and the inbox. Needs the functions emulator (the moderation callables).
// The spots used here are created in beforeAll and removed afterwards; no seeded fixture changes.

test.describe.configure({ mode: 'serial' });

const SUFFIX = Date.now().toString(36);
const PENDING = { id: `e2e-mod-pending-${SUFFIX}`, name: `E2E Mod Pending ${SUFFIX}` };
const APPROVED = { id: `e2e-mod-approved-${SUFFIX}`, name: `E2E Mod Approved ${SUFFIX}` };
const REMOVE = { id: `e2e-mod-remove-${SUFFIX}`, name: `E2E Mod Remove ${SUFFIX}` };
const RENAMED = `E2E Mod Renamed ${SUFFIX}`;

const spotData = async (id: string) => (await adminDb().doc(`spots/${id}`).get()).data();

async function cleanup() {
  const db = adminDb();
  await Promise.all([PENDING, APPROVED, REMOVE].flatMap(({ id }) => [
    db.doc(`spots/${id}`).delete(),
    db.doc(`spotEdits/${id}`).delete(),
  ]));
}

test.beforeAll(async () => {
  await cleanup();
  const db = adminDb();
  const base = {
    category: 'other', description: 'moderation fixture', location: { lat: 47.52, lng: 19.08 },
    createdBy: E2E.user.uid, createdByName: E2E.user.username, createdAt: Timestamp.now(),
    imageUrls: ['/icon-192x192.png'], reviews: [],
  };
  await db.doc(`spots/${PENDING.id}`).set({ ...base, name: PENDING.name, status: 'pending' });
  await db.doc(`spots/${APPROVED.id}`).set({ ...base, name: APPROVED.name, status: 'approved' });
  await db.doc(`spots/${REMOVE.id}`).set({ ...base, name: REMOVE.name, status: 'approved' });
});
test.afterAll(cleanup);

test.beforeEach(async ({ page }) => {
  await skipFirstRunOverlays(page);
  await blockMapTiles(page);
});

async function openQueue(page: Page, queue: 'Spots' | 'Changes') {
  await page.getByRole('button', { name: 'Profile' }).click();
  await page.getByRole('button', { name: /Pending Approval/ }).click();
  await page.getByRole('radio', { name: new RegExp(queue) }).click();
}

/** The owner's profile card (the map pin has the same name, as a marker). */
const profileCard = (page: Page, name: string) => page.locator(`button[aria-label="${name}"]`);

async function openOwnSpotDetails(page: Page, name: string) {
  await page.getByRole('button', { name: 'Profile' }).click();
  await profileCard(page, name).click();
  await page.getByRole('region', { name }).getByRole('button', { name: 'Details', exact: true }).click();
  await expect(page.getByRole('heading', { name })).toBeVisible();
}

test('an admin rejects a pending spot with a reason', async ({ page }) => {
  await openApp(page);
  await signInWithEmail(page, E2E.admin.email, E2E.password);
  await openQueue(page, 'Spots');
  await page.getByRole('region', { name: PENDING.name }).getByRole('button', { name: 'Reject', exact: true }).click();
  const confirm = page.getByRole('dialog', { name: 'Reject spot' }).getByRole('button', { name: 'Reject', exact: true });
  await expect(confirm).toBeDisabled();
  await page.locator('#moderation-reason').fill('The photo does not show the place');
  await confirm.click();
  await expectNotification(page, 'Rejected, the uploader has been told');

  await expect.poll(async () => (await spotData(PENDING.id))?.status).toBe('rejected');
  expect((await spotData(PENDING.id))?.rejection?.reason).toBe('The photo does not show the place');
});

test('the owner reads the reason in the profile and on the spot, then resubmits it', async ({ page }) => {
  await openApp(page);
  await signInWithEmail(page, E2E.user.email, E2E.password);
  await page.getByRole('button', { name: 'Profile' }).click();
  await expect(profileCard(page, PENDING.name).getByText('Reason: The photo does not show the place')).toBeVisible();
  await openApp(page); // a fresh page, still signed in

  await openOwnSpotDetails(page, PENDING.name);
  await expect(page.getByText('This spot was not approved')).toBeVisible();
  await page.getByRole('button', { name: 'Resubmit for review' }).click();
  await expectNotification(page, 'Sent for review again');
  await expect.poll(async () => (await spotData(PENDING.id))?.status).toBe('pending');
  expect((await spotData(PENDING.id))?.rejection).toBeUndefined();

  // The rejection also stays in the notification centre (the server inbox).
  const inbox = await adminDb().collection(`users/${E2E.user.uid}/inbox`).where('spotId', '==', PENDING.id).get();
  expect(inbox.docs.map((d) => d.get('type'))).toContain('spot_rejected');
});

test('the owner of an approved spot proposes a new name; the spot keeps its name meanwhile', async ({ page }) => {
  await openApp(page);
  await signInWithEmail(page, E2E.user.email, E2E.password);
  await openOwnSpotDetails(page, APPROVED.name);
  await page.getByRole('button', { name: 'Edit Spot' }).click();
  await page.locator('input[type="text"]').first().fill(RENAMED);
  await page.getByRole('button', { name: 'Save' }).click();
  await expectNotification(page, 'Changes sent for review');
  await expect(page.getByText('Your changes are waiting for review')).toBeVisible();

  const edit = (await adminDb().doc(`spotEdits/${APPROVED.id}`).get()).data();
  expect(edit).toMatchObject({ status: 'pending', ownerId: E2E.user.uid, proposed: { name: RENAMED } });
  expect((await spotData(APPROVED.id))?.name).toBe(APPROVED.name);
});

test('an admin sees the change as old → new and approves it', async ({ page }) => {
  await openApp(page);
  await signInWithEmail(page, E2E.admin.email, E2E.password);
  await openQueue(page, 'Changes');
  const card = page.getByRole('region', { name: APPROVED.name });
  await expect(card.getByText(APPROVED.name).last()).toBeVisible();
  await expect(card.getByText(RENAMED)).toBeVisible();
  await card.getByRole('button', { name: 'Approve', exact: true }).click();
  await expectNotification(page, 'Changes approved');

  await expect.poll(async () => (await spotData(APPROVED.id))?.name).toBe(RENAMED);
  expect((await adminDb().doc(`spotEdits/${APPROVED.id}`).get()).exists).toBe(false);
});

test('an admin deletes a spot with a reason; the owner reads it in the notification centre', async ({ page, browser }) => {
  await openApp(page);
  await signInWithEmail(page, E2E.admin.email, E2E.password);
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  await page.locator('button').filter({ hasText: REMOVE.name }).first().click();
  await page.getByRole('button', { name: 'Delete Spot' }).click();
  await page.locator('#moderation-reason').fill('Duplicate of another spot');
  await page.getByRole('dialog', { name: 'Delete spot' }).getByRole('button', { name: 'Delete Spot' }).click();
  await expectNotification(page, 'Spot deleted!');
  await expect.poll(async () => (await spotData(REMOVE.id)) === undefined).toBe(true);

  // The owner, on another device: the inbox is on the server.
  const owner = await (await browser.newContext({ locale: 'en-US' })).newPage();
  await skipFirstRunOverlays(owner);
  await blockMapTiles(owner);
  await openApp(owner);
  await signInWithEmail(owner, E2E.user.email, E2E.password);
  await owner.getByRole('button', { name: 'Notifications' }).click();
  await expect(owner.getByText('Your spot was removed').first()).toBeVisible();
  await expect(owner.getByText(`"${REMOVE.name}": Duplicate of another spot`)).toBeVisible();
  await owner.context().close();
});
