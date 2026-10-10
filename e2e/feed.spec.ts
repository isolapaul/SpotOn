import { expect } from '@playwright/test';
import { adminDb } from './adminDb';
import { E2E } from './fixtures';
import { test, blockMapTiles, openApp, signInWithEmail, skipFirstRunOverlays } from './helpers';

// The following feed: signed out it shows the community's spots under a sign-in card; signed in,
// the spots of followed people come first, a card's name flies to the spot on the map and back
// returns to the feed. The follow edge is written directly (no callable) and removed afterwards.

test.describe.configure({ mode: 'serial' });

const EDGE = `follows/${E2E.user.uid}_${E2E.admin.uid}`;

test.beforeAll(async () => {
  await adminDb().doc(EDGE).set({ follower: E2E.user.uid, target: E2E.admin.uid, createdAt: new Date() });
});
test.afterAll(async () => {
  await adminDb().doc(EDGE).delete();
});

test.beforeEach(async ({ page }) => {
  await skipFirstRunOverlays(page);
  await blockMapTiles(page);
});

test('signed out: community spots with their posters and a sign-in card', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: 'Feed', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Feed', level: 2 })).toBeVisible();
  await expect(page.getByText('Follow people who find great spots')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Spots from the community' })).toBeVisible();
  await expect(page.getByRole('article', { name: E2E.detailsSpot.name })).toBeVisible();
  // Never pending spots.
  await expect(page.getByRole('article', { name: E2E.pendingSpot.name })).toHaveCount(0);
});

test('signed in: followed people first; a card flies to the map and back returns', async ({ page }) => {
  await openApp(page);
  await signInWithEmail(page, E2E.user.email, E2E.password);
  await page.getByRole('button', { name: /^Feed(,|$)/ }).click();
  const card = page.getByRole('article', { name: E2E.detailsSpot.name });
  await expect(card).toBeVisible();
  await expect(card.getByRole('button', { name: E2E.admin.username, exact: true })).toBeVisible();
  // Followed spots come before the community section; the user's own spots are marked.
  await expect(page.getByRole('heading', { name: 'Earlier spots' })).toBeVisible();
  await expect(page.getByRole('article', { name: E2E.modernSpot.name }).getByText('You shared this')).toBeVisible();

  // A sheet over the feed closes first on Escape (and the system back); the feed stays.
  await card.getByRole('button', { name: 'Reviews' }).click();
  await expect(page.getByRole('dialog', { name: 'Reviews' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Reviews' })).toHaveCount(0);
  await expect(card).toBeVisible();

  // Near me (the test browser sits in Budapest, next to every fixture): the cards stay.
  await page.getByRole('radio', { name: 'Near me' }).click();
  await expect(page.getByRole('radio', { name: 'Near me' })).toHaveAttribute('aria-checked', 'true');
  await expect(card).toBeVisible();
  await page.getByRole('radio', { name: 'Everyone' }).click();

  await card.getByRole('button', { name: 'Show on map' }).click();
  await expect(page.getByRole('heading', { name: 'Feed', level: 2 })).toHaveCount(0);
  await page.getByRole('button', { name: 'Back to the feed' }).click();
  await expect(page.getByRole('article', { name: E2E.detailsSpot.name })).toBeVisible();
});
