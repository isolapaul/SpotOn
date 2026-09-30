import { expect } from '@playwright/test';
import { E2E } from './fixtures';
import { test, blockMapTiles, openApp, signInWithEmail, skipFirstRunOverlays } from './helpers';

// Level identity: the level-up celebration shows once when the own level (from the server, item 5)
// passes a level this device has not seen, and never on a first sighting. Read-only: only localStorage is set.

test.beforeEach(async ({ page }) => {
  await skipFirstRunOverlays(page);
  await blockMapTiles(page);
});

const celebration = (page: import('@playwright/test').Page) => page.getByRole('dialog', { name: 'Cartographer' });

test('a level above the one last seen is celebrated once', async ({ page }) => {
  await page.addInitScript((uid) => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem(`spoton-level-seen:${uid}`, '4');
      sessionStorage.setItem('seeded', '1');
    }
  }, E2E.level5.uid);
  await openApp(page);
  await signInWithEmail(page, E2E.level5.email, E2E.password);

  await expect(celebration(page)).toBeVisible();
  await expect(celebration(page).getByText('Level up!')).toBeVisible();
  await celebration(page).getByRole('button', { name: 'Awesome!' }).click();
  await expect(celebration(page)).toHaveCount(0);
  expect(await page.evaluate((uid) => localStorage.getItem(`spoton-level-seen:${uid}`), E2E.level5.uid)).toBe('5');

  // Seen now: a reload does not celebrate again.
  await page.reload();
  await openApp(page);
  await expect(page.getByRole('button', { name: 'Profile', exact: true })).toBeVisible();
  await page.waitForTimeout(1500);
  await expect(celebration(page)).toHaveCount(0);
});

test('a first sighting is recorded without a celebration', async ({ page }) => {
  await openApp(page);
  await signInWithEmail(page, E2E.level5.email, E2E.password);
  await expect
    .poll(() => page.evaluate((uid) => localStorage.getItem(`spoton-level-seen:${uid}`), E2E.level5.uid))
    .toBe('5');
  await expect(celebration(page)).toHaveCount(0);
});
