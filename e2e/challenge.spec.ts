import { expect } from '@playwright/test';
import { E2E } from './fixtures';
import { test, blockMapTiles, openApp, signInWithEmail, skipFirstRunOverlays } from './helpers';

// Growth plan §8: the launch challenge card shows the five steps, the own spot already ticked.
// Read-only.

test.beforeEach(async ({ page }) => {
  await skipFirstRunOverlays(page);
  await blockMapTiles(page);
});

test('signed in, Explore shows the launch challenge with its steps', async ({ page }) => {
  await openApp(page);
  await signInWithEmail(page, E2E.user.email, E2E.password);
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  const card = page.locator('section').filter({ hasText: 'Become a SpotOn Founder' });
  await expect(card).toBeVisible();
  await expect(card.getByText('Share your first spot')).toHaveClass(/line-through/);
  await expect(card.getByText('Collect an "I was here" stamp')).toBeVisible();
});

test('signed out, there is no challenge card', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  await expect(page.getByText('Become a SpotOn Founder')).toHaveCount(0);
});
