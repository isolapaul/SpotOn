import { expect } from '@playwright/test';
import { adminDb } from './adminDb';
import { E2E } from './fixtures';
import { test, blockMapTiles, expectNotification, openApp, signInWithEmail, skipFirstRunOverlays } from './helpers';

// Growth plan §2: the personal invite link, an opened invite link, and naming the inviter (the
// last test needs the functions emulator: claimReferral). Restores everything it changes.

test.describe.configure({ mode: 'serial' });

let saved: { user?: FirebaseFirestore.DocumentData; profile?: FirebaseFirestore.DocumentData } = {};

test.beforeAll(async () => {
  const db = adminDb();
  saved = {
    user: (await db.doc(`users/${E2E.user.uid}`).get()).data(),
    profile: (await db.doc(`publicProfiles/${E2E.user.uid}`).get()).data(),
  };
});
test.afterAll(async () => {
  const db = adminDb();
  const { FieldValue } = await import('firebase-admin/firestore');
  await db.doc(`referrals/${E2E.invitee.uid}`).delete();
  await db.doc(`users/${E2E.invitee.uid}`).update({ referredBy: FieldValue.delete() });
  // The inviter's XP and invite count as before (the trigger does not undo a deleted referral).
  const pick = (d: FirebaseFirestore.DocumentData | undefined, keys: string[]) =>
    Object.fromEntries(keys.map((k) => [k, d?.[k] ?? FieldValue.delete()]));
  await db.doc(`users/${E2E.user.uid}`).update(pick(saved.user, ['xp', 'level', 'levelFloor']));
  await db.doc(`publicProfiles/${E2E.user.uid}`).set(pick(saved.profile, ['xp', 'level', 'invitesCount']), { merge: true });
  const inbox = await db.collection(`users/${E2E.user.uid}/inbox`).where('type', '==', 'invite_joined').get();
  await Promise.all(inbox.docs.map((d) => d.ref.delete()));
});

test.beforeEach(async ({ page }) => {
  await skipFirstRunOverlays(page);
  await blockMapTiles(page);
});

test('the own invite sheet shows the personal link and the steps', async ({ page }) => {
  await openApp(page);
  await signInWithEmail(page, E2E.user.email, E2E.password);
  await page.getByRole('button', { name: 'Profile' }).click();
  await page.getByRole('button', { name: 'Invite friends' }).click();
  const sheet = page.getByRole('dialog', { name: 'Invite friends' });
  await expect(sheet.getByText(`spoton.isolapaul.hu/i/${E2E.user.username}`)).toBeVisible();
  await expect(sheet.getByRole('button', { name: 'Share your link' })).toBeVisible();
  await expect(sheet.getByText('10', { exact: true })).toBeVisible();
});

test('an opened invite link is remembered and asks a signed-out visitor to sign in', async ({ page }) => {
  await page.goto(`/i/${E2E.user.username}`);
  await expect(page.getByTestId('loading-screen')).toHaveCount(0, { timeout: 30_000 });
  await expect(page.getByRole('button', { name: 'With Email' })).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('spoton-invite') ?? '{}').state?.pendingCode))
    .toBe(E2E.user.username);
});

test('a new account names its inviter; both get the invite recorded', async ({ page }) => {
  await page.goto(`/i/${E2E.user.username}`);
  await expect(page.getByTestId('loading-screen')).toHaveCount(0, { timeout: 30_000 });
  await page.getByRole('button', { name: 'With Email' }).click();
  await page.locator('input[type="email"]').fill(E2E.invitee.email);
  await page.locator('input[type="password"]').fill(E2E.password);
  await page.locator('form button[type="submit"]').click();
  // The prompt opens with the remembered code.
  const prompt = page.getByRole('dialog', { name: 'Who invited you?' });
  await expect(prompt.getByRole('textbox', { name: 'username' })).toHaveValue(E2E.user.username);
  await prompt.getByRole('button', { name: 'Done' }).click();
  await expectNotification(page, `Thanks! ${E2E.user.username}'s invite is saved, +10 XP`);
  await expect.poll(async () => (await adminDb().doc(`referrals/${E2E.invitee.uid}`).get()).get('referrer')).toBe(E2E.user.uid);
  await expect.poll(async () => (await adminDb().doc(`publicProfiles/${E2E.user.uid}`).get()).get('invitesCount')).toBe(1);
});
