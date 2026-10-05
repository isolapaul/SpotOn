import { test as base, expect, type Page } from '@playwright/test';

// T31: React render-loop symptoms (zustand 5 uses React's native useSyncExternalStore, so a selector
// returning a new object/array each call loops). Dev builds log "getSnapshot should be cached" /
// "Maximum update depth exceeded"; production builds throw the minified errors #185 / #301.
const RENDER_LOOP = /getSnapshot|Maximum update depth|Too many re-renders|Minified React error #(185|301)\b/;

/** Playwright `test` with an automatic guard: fails if any page logs or throws a React render-loop error. */
export const test = base.extend<{ renderLoopGuard: void }>({
  renderLoopGuard: [
    async ({ context }, use) => {
      const hits: string[] = [];
      context.on('console', (m) => {
        if (RENDER_LOOP.test(m.text())) hits.push(`console.${m.type()}: ${m.text()}`);
      });
      context.on('weberror', (e) => {
        const err = e.error();
        if (RENDER_LOOP.test(`${err.message}\n${err.stack ?? ''}`)) hits.push(`pageerror: ${err.message}`);
      });
      await use();
      expect(hits, 'React render-loop errors in the browser console').toEqual([]);
    },
    { auto: true },
  ],
});

/** The first-run tour's completion record (lib/onboarding: ONBOARDING_STORAGE_KEY, ONBOARDING_VERSION). */
export const ONBOARDING_DONE = { key: 'spoton-onboarding', value: JSON.stringify({ version: 1, completedAt: '2026-10-04T00:00:00.000Z' }) };

/** Pre-seeds localStorage so the first-run tour never shows and the language is set. Call before page.goto. */
export async function skipFirstRunOverlays(page: Page, language: 'en' | 'hu' | 'de' = 'en') {
  await page.addInitScript(({ lang, done }) => {
    window.localStorage.setItem(done.key, done.value);
    window.localStorage.setItem(
      'spoton-language',
      JSON.stringify({ state: { language: lang, hasSelectedLanguage: true }, version: 0 }),
    );
  }, { lang: language, done: ONBOARDING_DONE });
}

/** Aborts map requests so tests never depend on Mapbox (without a token none are made anyway). */
export async function blockMapTiles(page: Page) {
  await page.route(/(api|events)\.mapbox\.com|tiles\.mapbox\.com/, (route) => route.abort());
}

/** Opens the app and waits until LoadingScreen has unmounted. */
export async function openApp(page: Page) {
  await page.goto('/');
  await expect(page.getByTestId('loading-screen')).toHaveCount(0, { timeout: 30_000 });
}

/** Map marker(s) of the given category (design 1D pins carry data-category). */
export function spotMarker(page: Page, category: string) {
  return page.locator(`.spot-marker:has(.spot-pin[data-category="${category}"])`);
}

/** Signs in through the AuthModal email form (English UI). App must be open and signed out. */
export async function signInWithEmail(page: Page, email: string, password: string) {
  await page.getByRole('button', { name: 'Profile' }).click();
  await page.getByRole('button', { name: 'With Email' }).click();
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('form button[type="submit"]').click();
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
}

/** Toasts are recorded in the persisted notification store, never shown as popups. Polls it for a body. */
export async function expectNotification(page: Page, body: string) {
  await expect
    .poll(() =>
      page.evaluate((b) => {
        try {
          const raw = window.localStorage.getItem('spoton-notifications');
          const list: Array<{ body?: string }> = raw ? JSON.parse(raw).state?.notifications ?? [] : [];
          return list.some((n) => n.body === b);
        } catch {
          return false;
        }
      }, body),
    )
    .toBe(true);
}
