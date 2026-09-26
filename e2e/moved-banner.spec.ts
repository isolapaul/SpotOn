import { expect, test, type Page } from '@playwright/test';
import { blockMapTiles, openApp } from './helpers';

// T19: domain-move banner. It exists only in a build with NEXT_PUBLIC_MOVED_TO set (the Vercel build);
// Playwright passes the variable through to the webServer build (playwright.config.ts).
// Run with the flag:
//   NEXT_PUBLIC_MOVED_TO=https://spoton.isolapaul.hu npx firebase emulators:exec --only auth,firestore,storage \
//     --project demo-spoton "npx tsx scripts/seed-emulator.ts && npx playwright test e2e/moved-banner.spec.ts"
// Without the flag (normal e2e run) only the absence check runs.

const MOVED_TO = process.env.NEXT_PUBLIC_MOVED_TO ?? '';
const DISMISS_KEY = 'spoton-moved-banner-dismissed';

type Lang = 'hu' | 'en';
const TEXT: Record<Lang, { hide: string; installGate: string }> = {
  hu: { hide: 'Elrejtés', installGate: 'SpotOn Élmény' },
  en: { hide: 'Hide', installGate: 'SpotOn Experience' },
};

test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });

/** Seeds only the language choice, so InstallGate would appear unless the move guard suppresses it. */
async function seedLanguage(page: Page, lang: Lang) {
  await page.addInitScript((l) => {
    window.localStorage.setItem(
      'spoton-language',
      JSON.stringify({ state: { language: l, hasSelectedLanguage: true }, version: 0 }),
    );
  }, lang);
}

function banner(page: Page) {
  return page.getByRole('status').filter({ hasText: new URL(MOVED_TO).host });
}

test.beforeEach(async ({ page }) => {
  await blockMapTiles(page);
});

for (const lang of ['hu', 'en'] as const) {
  test(`banner shows on the old domain (${lang})`, async ({ page }) => {
    test.skip(!MOVED_TO, 'needs a build with NEXT_PUBLIC_MOVED_TO');
    await seedLanguage(page, lang);
    await openApp(page);

    await expect(banner(page)).toBeVisible();
    const href = await banner(page).getByRole('link').getAttribute('href');
    expect(href?.startsWith(MOVED_TO)).toBe(true);
    await expect(page.getByText(TEXT[lang].installGate)).toHaveCount(0);

    // One row below the top buttons, never overlapping them.
    const themeBox = await page.getByRole('button', { name: 'Map Theme' }).boundingBox();
    const bannerBox = await banner(page).boundingBox();
    expect(themeBox && bannerBox && bannerBox.y >= themeBox.y + themeBox.height).toBeTruthy();

    await page.screenshot({ path: `docs/screenshots/moved-banner-${lang}.png`, fullPage: true });
  });
}

test('Hide dismisses the banner permanently on this device', async ({ page }) => {
  test.skip(!MOVED_TO, 'needs a build with NEXT_PUBLIC_MOVED_TO');
  await seedLanguage(page, 'en');
  await openApp(page);
  await expect(banner(page)).toBeVisible();

  await banner(page).getByRole('button', { name: TEXT.en.hide }).click();
  await expect(banner(page)).toHaveCount(0);
  expect(await page.evaluate((k) => window.localStorage.getItem(k), DISMISS_KEY)).toBe('1');

  for (let i = 0; i < 2; i++) {
    await openApp(page); // full reload of the page
    await expect(page.getByRole('button', { name: 'Profile' })).toBeVisible();
    await expect(banner(page)).toHaveCount(0);
  }

  await page.evaluate((k) => window.localStorage.removeItem(k), DISMISS_KEY);
  await openApp(page);
  await expect(banner(page)).toBeVisible();
});

test('no banner without NEXT_PUBLIC_MOVED_TO', async ({ page }) => {
  test.skip(!!MOVED_TO, 'only for a normal build');
  await seedLanguage(page, 'en');
  await openApp(page);
  await expect(page.getByRole('button', { name: 'Profile' })).toBeVisible();
  await expect(page.getByText('spoton.isolapaul.hu')).toHaveCount(0);
});
