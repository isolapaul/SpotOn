import { expect, type Page } from '@playwright/test';
import { E2E } from './fixtures';
import { test, blockMapTiles, openApp, signInWithEmail, skipFirstRunOverlays } from './helpers';

// T27: the split ProfilePanel. Read-only: opens and closes panels, never mutates a fixture.

test.beforeEach(async ({ page }) => {
  await skipFirstRunOverlays(page);
  await blockMapTiles(page);
});

async function openProfile(page: Page, username: string) {
  await page.getByRole('button', { name: 'Profile' }).click();
  await expect(page.getByRole('heading', { name: username })).toBeVisible();
}

test('level-5 user: level pill, progress, tabs, highlight manager and level info', async ({ page }) => {
  await openApp(page);
  await signInWithEmail(page, E2E.level5.email, E2E.password);
  await openProfile(page, E2E.level5.username);

  // 1. Level pill and progress card (20 own spots, pending ones included → level 5)
  const levelPill = page.getByRole('button', { name: /Level 5/ });
  await expect(levelPill).toBeVisible();
  await expect(page.getByText('Cartographer', { exact: true })).toBeVisible();
  await expect(page.getByText('100%', { exact: true })).toBeVisible();

  // 2. Tabs: a non-admin sees only My Spots and Favorites
  await expect(page.getByRole('button', { name: /Pending Approval/ })).toHaveCount(0);
  const ownPendingSpot = page.getByRole('heading', { name: 'E2E Level5 Pending 02' });
  await expect(ownPendingSpot).toBeVisible();
  await page.getByRole('button', { name: 'Favorites', exact: true }).click();
  await expect(ownPendingSpot).toHaveCount(0);
  await page.getByRole('button', { name: 'My Spots', exact: true }).click();
  await expect(ownPendingSpot).toBeVisible();

  // 3. Highlight manager opens and closes
  const highlightHeading = page.getByRole('heading', { name: /Highlight spots/ });
  await page.getByRole('button', { name: /Highlight spots/ }).click();
  await expect(highlightHeading).toBeVisible();
  await page.getByRole('button', { name: /Close highlights/ }).click();
  await expect(highlightHeading).toHaveCount(0);

  // 4. Level info modal opens from the pill and closes on its backdrop
  await levelPill.click();
  await expect(page.getByRole('heading', { name: 'Level System' })).toBeVisible();
  await page.getByRole('button', { name: 'Close level info' }).click({ position: { x: 5, y: 5 } });
  await expect(page.getByRole('heading', { name: 'Level System' })).toHaveCount(0);
});

test('super admin: the admin tab shows the admin list', async ({ page }) => {
  await openApp(page);
  await signInWithEmail(page, E2E.superAdmin.email, E2E.password);
  await openProfile(page, E2E.superAdmin.username);

  await page.getByRole('button', { name: 'admin', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Current Admins' })).toBeVisible();
  await expect(page.getByText(E2E.admin.email, { exact: true })).toBeVisible();
});
