import { expect, type Page } from '@playwright/test';
import { E2E } from './fixtures';
import { test, blockMapTiles, openApp, signInWithEmail, skipFirstRunOverlays, spotMarker } from './helpers';
import { buildCsp } from '../src/lib/csp.mjs';

// T15: the smoke flow must produce zero Content-Security-Policy violations under the emulator-build CSP.
// T32: pages get a per-request nonce policy ('strict-dynamic', no 'unsafe-inline' in script-src) from
// src/proxy.ts; /api/* keeps T15's static policy (the FCM service worker's CSP comes from its own response).
// Map tiles are aborted (blockMapTiles) after the CSP check, so the tile hosts are still checked against
// img-src; the tile images themselves are covered by scripts/check-headers.sh and the manual checklist.
// Google popup sign-in cannot run against the emulator: manual check (docs/tasks/T32-nonce-csp.md step 7).

declare global {
  interface Window {
    __csp?: string[];
  }
}

const violations: string[] = [];

/** Moves the violations recorded in the current document into `violations` (call before navigating). */
async function drainCsp(page: Page) {
  const found = await page.evaluate(() => window.__csp?.splice(0) ?? []);
  violations.push(...found);
}

/** Static T15 policy of the emulator test build (playwright.config.ts builds with NEXT_PUBLIC_USE_EMULATORS=1). */
const API_CSP = buildCsp({ nonce: null, isDev: false, useEmulators: true });

test.beforeEach(async ({ page }) => {
  violations.length = 0;
  page.on('console', (m) => {
    if (/Content Security Policy|Refused to|CSP violation/i.test(m.text())) violations.push(m.text());
  });
  await page.addInitScript(() => {
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      window.__csp?.push(`${e.violatedDirective} ${e.blockedURI}`);
      console.error('CSP violation', e.violatedDirective, e.blockedURI);
    });
  });
  await skipFirstRunOverlays(page);
  await blockMapTiles(page);
});

test('smoke flow has no CSP violations', async ({ page }) => {
  // Guard against a vacuous pass: the page must actually be served with the nonce policy.
  const res = await page.request.get('/');
  const pageCsp = res.headers()['content-security-policy'] ?? '';
  expect(pageCsp).toContain("default-src 'self'");
  expect(pageCsp).toContain("'strict-dynamic'");
  expect(pageCsp).toContain("'nonce-");
  const scriptSrc = pageCsp.split(';').map((d) => d.trim()).find((d) => d.startsWith('script-src '));
  expect(scriptSrc).toBeDefined();
  expect(scriptSrc).not.toContain("'unsafe-inline'");
  expect(scriptSrc).not.toContain("'unsafe-eval'");

  // 1. Load the app; the seeded markers render.
  await openApp(page);
  await expect(spotMarker(page, E2E.legacySpot.category)).toBeVisible();

  // 2. Map themes: standard → satellite → dark (tile hosts are checked against img-src).
  for (const theme of ['Satellite', 'Dark']) {
    await page.getByRole('button', { name: 'Map Theme' }).click();
    await page.getByRole('button', { name: theme, exact: true }).click();
    await expect(page.getByRole('group', { name: 'Map Theme' })).toHaveCount(0);
  }

  // 3. Info window → details → gallery (legacy spot: one image).
  await spotMarker(page, E2E.legacySpot.category).click();
  await page.getByRole('button', { name: 'View Details' }).click();
  const img = page.getByRole('img', { name: E2E.legacySpot.name }).first();
  await expect(img).toBeVisible();
  await expect
    .poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0))
    .toBe(true);
  const galleryImage = page.getByRole('img', { name: `${E2E.legacySpot.name} - Image 1`, exact: true });
  await expect(async () => {
    await img.click(); // the hero ignores clicks for a moment after opening
    await expect(galleryImage).toBeVisible({ timeout: 1000 });
  }).toPass();
  await page.keyboard.press('Escape');
  await expect(galleryImage).toHaveCount(0);

  // 4.–5. Sign in (AuthModal, email against the emulator), open the profile panel and its settings.
  await drainCsp(page);
  await openApp(page);
  await signInWithEmail(page, E2E.user.email, E2E.password);
  await page.getByRole('button', { name: 'Profile' }).click();
  await expect(page.getByRole('heading', { name: E2E.user.username })).toBeVisible();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Settings/ })).toBeVisible();

  // Open the feedback panel (fresh load; the session persists).
  await drainCsp(page);
  await openApp(page);
  await page.getByRole('button', { name: 'Feedback' }).click();
  await expect(page.getByRole('heading', { name: 'Feedback' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Patch Notes' })).toBeVisible();

  // 6. FCM service worker: register() must settle (the worker's importScripts from gstatic may be
  // unreachable here, so activation is not awaited), and the worker keeps T15's static policy.
  const settled = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return 'unavailable';
    const timeout = new Promise<string>((resolve) => setTimeout(() => resolve('timeout'), 10_000));
    const register = navigator.serviceWorker
      .register('/api/firebase-messaging-sw', { scope: '/' })
      .then(() => 'resolved', () => 'rejected');
    return Promise.race([register, timeout]);
  });
  expect(['resolved', 'rejected', 'unavailable']).toContain(settled);
  const sw = await page.request.get('/api/firebase-messaging-sw');
  expect(sw.status()).toBe(200);
  expect(sw.headers()['content-security-policy']).toBe(API_CSP);

  await drainCsp(page);
  expect(violations).toEqual([]);
});

// Proves the policy is enforced, not just present: an injected inline event handler must be blocked
// (T15's 'unsafe-inline' let it run). Separate from the smoke test, which asserts zero violations.
test('page CSP blocks inline event handlers', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const w = window as Window & { __handlerRan?: boolean };
    const seen: string[] = [];
    document.addEventListener('securitypolicyviolation', (e) => seen.push(e.effectiveDirective));
    const img = document.createElement('img');
    img.setAttribute('onerror', 'window.__handlerRan = true');
    img.src = '/__csp-probe-missing.png';
    document.body.appendChild(img);
    await new Promise((r) => setTimeout(r, 1000));
    img.remove();
    return { ran: w.__handlerRan === true, seen };
  });
  expect(result.ran).toBe(false);
  expect(result.seen).toContain('script-src-attr');
});

// Unknown paths render Next's HTML 404 page; it must carry the nonce policy too (proxy matcher).
test('404 pages get the nonce policy', async ({ page }) => {
  for (const path of ['/nope', '/icon-nope', '/__/nope', '/faviconXico']) {
    const res = await page.request.get(path);
    const csp = res.headers()['content-security-policy'] ?? '';
    expect(csp, path).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
  }
});
