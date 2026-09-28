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

/** Pre-seeds localStorage so InstallGate and LanguageSelector never render. Call before page.goto. */
export async function skipFirstRunOverlays(page: Page, language: 'en' | 'hu' | 'de' = 'en') {
  await page.addInitScript((lang) => {
    window.localStorage.setItem('spoton-install-prompt-dismissed', 'true');
    window.localStorage.setItem(
      'spoton-language',
      JSON.stringify({ state: { language: lang, hasSelectedLanguage: true }, version: 0 }),
    );
  }, language);
}

/** Aborts map tile requests so tests never depend on third-party tile servers. */
export async function blockMapTiles(page: Page) {
  await page.route(/(openstreetmap|cartocdn|arcgisonline)\./, (route) => route.abort());
}

/** Opens the app and waits until LoadingScreen has unmounted. */
export async function openApp(page: Page) {
  await page.goto('/');
  await expect(page.locator('div.fixed.inset-0.bg-slate-900')).toHaveCount(0, { timeout: 30_000 });
}

/** Leaflet marker(s) of the given category (design 1D pins carry data-category). */
export function spotMarker(page: Page, category: string) {
  return page.locator(`.leaflet-marker-icon:has(.spot-pin[data-category="${category}"])`);
}

/** Pins by variant: 'approved' (green) or 'pending' (any non-approved status). */
export function pinsOf(page: Page, variant: 'approved' | 'pending') {
  return page.locator(`.leaflet-marker-icon .spot-pin[data-variant="${variant}"]`);
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
