import { expect, type Page } from '@playwright/test';
import { test, blockMapTiles, openApp, ONBOARDING_DONE } from './helpers';

// T19: domain-move banner. It exists only in a build with NEXT_PUBLIC_MOVED_TO set (the Vercel build);
// Playwright passes the variable through to the webServer build (playwright.config.ts).
// Run with the flag:
//   NEXT_PUBLIC_MOVED_TO=https://spoton.isolapaul.hu npx firebase emulators:exec --only auth,firestore,storage \
//     --project demo-spoton "npx tsx scripts/seed-emulator.ts && npx playwright test e2e/moved-banner.spec.ts"
// Without the flag (normal e2e run) only the absence check runs.

const MOVED_TO = process.env.NEXT_PUBLIC_MOVED_TO ?? '';
const DISMISS_KEY = 'spoton-moved-banner-dismissed';

type Lang = 'hu' | 'en';
const TEXT: Record<Lang, { hide: string; mapControls: string }> = {
  hu: { hide: 'Elrejtés', mapControls: 'Térképvezérlők' },
  en: { hide: 'Hide', mapControls: 'Map controls' },
};

test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });

/** Seeds the language choice and the completed first-run tour (its old-domain variant is tested below). */
async function seedLanguage(page: Page, lang: Lang) {
  await page.addInitScript(({ l, done }) => {
    window.localStorage.setItem(done.key, done.value);
    window.localStorage.setItem(
      'spoton-language',
      JSON.stringify({ state: { language: l, hasSelectedLanguage: true }, version: 0 }),
    );
  }, { l: lang, done: ONBOARDING_DONE });
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

    // In the top-left slot, never overlapping the control stack on the right (design 1C).
    // The toolbar's accessible name is translated (t('mapControls')).
    const stackBox = await page.getByRole('toolbar', { name: TEXT[lang].mapControls }).boundingBox();
    const bannerBox = await banner(page).boundingBox();
    expect(stackBox && bannerBox && bannerBox.x + bannerBox.width <= stackBox.x).toBeTruthy();

    await page.screenshot({ path: test.info().outputPath(`moved-banner-${lang}.png`), fullPage: true });
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

test('the first-run tour runs on the old domain, without the install step', async ({ page }) => {
  test.skip(!MOVED_TO, 'needs a build with NEXT_PUBLIC_MOVED_TO');
  await page.addInitScript(() => {
    window.localStorage.setItem('spoton-language', JSON.stringify({ state: { language: 'en', hasSelectedLanguage: true }, version: 0 }));
  });
  await page.goto('/');
  const tour = page.getByRole('dialog', { name: 'SpotOn tour' });
  await expect(tour).toBeVisible({ timeout: 30_000 });
  // Signed out: welcome, name, discover, share, levels, location, sign-up (no install).
  await expect(tour.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '7');
});

test('no banner without NEXT_PUBLIC_MOVED_TO', async ({ page }) => {
  test.skip(!!MOVED_TO, 'only for a normal build');
  await seedLanguage(page, 'en');
  await openApp(page);
  await expect(page.getByRole('button', { name: 'Profile' })).toBeVisible();
  await expect(page.getByText('spoton.isolapaul.hu')).toHaveCount(0);
});
