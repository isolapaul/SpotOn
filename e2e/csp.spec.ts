import { expect, test } from '@playwright/test';
import { E2E } from './fixtures';
import { blockMapTiles, openApp, signInWithEmail, skipFirstRunOverlays, spotMarker } from './helpers';

// T15: the smoke flow must produce zero Content-Security-Policy violations under the emulator-build CSP.
// Map tiles are aborted (blockMapTiles), so tile hosts are covered by scripts/check-headers.sh instead.

const violations: string[] = [];

test.beforeEach(async ({ page }) => {
  violations.length = 0;
  page.on('console', (m) => {
    if (/Content Security Policy|Refused to|CSP violation/.test(m.text())) violations.push(m.text());
  });
  await page.addInitScript(() =>
    document.addEventListener('securitypolicyviolation', (e) =>
      console.error('CSP violation', e.violatedDirective, e.blockedURI),
    ),
  );
  await skipFirstRunOverlays(page);
  await blockMapTiles(page);
});

test('smoke flow has no CSP violations', async ({ page }) => {
  // Guard against a vacuous pass: the page must actually be served with our CSP.
  const res = await page.request.get('/');
  expect(res.headers()['content-security-policy']).toContain("default-src 'self'");

  await openApp(page);

  // Open a seeded spot.
  await spotMarker(page, E2E.legacySpot.emoji).click();
  await page.getByRole('button', { name: 'View Details' }).click();
  const img = page.getByRole('img', { name: E2E.legacySpot.name }).first();
  await expect(img).toBeVisible();
  await expect
    .poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0))
    .toBe(true);

  // Sign in, open the profile panel and its settings.
  await openApp(page);
  await signInWithEmail(page, E2E.user.email, E2E.password);
  await page.getByRole('button', { name: 'Profile' }).click();
  await expect(page.getByRole('heading', { name: E2E.user.username })).toBeVisible();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Settings/ })).toBeVisible();

  // Open the feedback panel (fresh load; the session persists).
  await openApp(page);
  await page.getByRole('button', { name: 'Feedback' }).click();
  await expect(page.getByRole('heading', { name: 'Feedback' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Patch Notes' })).toBeVisible();

  expect(violations).toEqual([]);
});
