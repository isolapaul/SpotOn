import { expect, test, type Page } from '@playwright/test';
import { E2E } from './fixtures';
import { blockMapTiles, expectNotification, openApp, signInWithEmail, skipFirstRunOverlays } from './helpers';

// T11a: admin state from admins/{uid}, usernames via the claimUsername callable, sign-out.
// Username changes use the dedicated E2E.rename fixture only (see fixtures.ts).

test.beforeEach(async ({ page }) => {
  await skipFirstRunOverlays(page);
  await blockMapTiles(page);
});

async function openProfile(page: Page, username: string) {
  await page.getByRole('button', { name: 'Profile' }).click();
  await expect(page.getByRole('heading', { name: username })).toBeVisible();
}

const pendingTab = (page: Page) => page.getByRole('button', { name: /Pending Approval/ });
const adminTab = (page: Page) => page.getByRole('button', { name: 'admin', exact: true });

test('regular user sees neither the pending nor the admin tab', async ({ page }) => {
  await openApp(page);
  await signInWithEmail(page, E2E.user.email, E2E.password);
  await openProfile(page, E2E.user.username);
  await expect(page.getByRole('button', { name: /My Spots/ })).toBeVisible();
  await expect(pendingTab(page)).toHaveCount(0);
  await expect(adminTab(page)).toHaveCount(0);
});

test('legacy admin sees the pending tab but not the admin tab', async ({ page }) => {
  await openApp(page);
  await signInWithEmail(page, E2E.admin.email, E2E.password);
  await openProfile(page, E2E.admin.username);
  await expect(pendingTab(page)).toBeVisible();
  await expect(adminTab(page)).toHaveCount(0);
});

test('super admin sees the admin tab without its own entry in the admin list', async ({ page }) => {
  await openApp(page);
  await signInWithEmail(page, E2E.superAdmin.email, E2E.password);
  await openProfile(page, E2E.superAdmin.username);
  await expect(pendingTab(page)).toBeVisible();
  await adminTab(page).click();
  await expect(page.getByRole('heading', { name: 'Current Admins' })).toBeVisible();
  await expect(page.getByText(E2E.admin.email, { exact: true })).toBeVisible();
  await expect(page.getByText(E2E.superAdmin.email, { exact: true })).toHaveCount(0);
});

test('username change is claimed and persists after reload', async ({ page }) => {
  const newName = `e2e_rn_${Date.now().toString(36)}`;

  await openApp(page);
  await signInWithEmail(page, E2E.rename.email, E2E.password);
  // Any current name: on a CI retry the fixture was already renamed by the first attempt.
  await page.getByRole('button', { name: 'Profile' }).click();

  await page.getByRole('button', { name: 'Edit Username' }).click();
  await page.locator('#edit-username').fill(newName);
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  await expectNotification(page, 'Username saved!');
  await expect(page.getByRole('heading', { name: newName })).toBeVisible();

  await openApp(page);
  await openProfile(page, newName);
});

test('username change to a taken name is rejected', async ({ page }) => {
  await openApp(page);
  await signInWithEmail(page, E2E.rename.email, E2E.password);
  await page.getByRole('button', { name: 'Profile' }).click();

  await page.getByRole('button', { name: 'Edit Username' }).click();
  await page.locator('#edit-username').fill(E2E.admin.username);
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  await expectNotification(page, 'Username is already taken');
  await expect(page.locator('#edit-username')).toHaveValue(E2E.admin.username);
});

test('sign-out succeeds', async ({ page }) => {
  await openApp(page);
  await signInWithEmail(page, E2E.user.email, E2E.password);
  await openProfile(page, E2E.user.username);

  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Sign Out', exact: true }).click();

  await expectNotification(page, 'Sign out successful');
});
