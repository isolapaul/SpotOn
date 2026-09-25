import { expect, type Page } from '@playwright/test';

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

/** Leaflet marker whose SVG shows the given category emoji. */
export function spotMarker(page: Page, emoji: string) {
  return page.locator('.leaflet-marker-icon').filter({ hasText: emoji });
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
