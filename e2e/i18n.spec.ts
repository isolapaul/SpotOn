import { expect, test } from '@playwright/test';
import { E2E } from './fixtures';
import { blockMapTiles, openApp, skipFirstRunOverlays, spotMarker } from './helpers';

// T24: one translation mechanism (useT / translate). Visible text per language must be unchanged.

const TEXT = {
  hu: { explore: 'Felfedezés', profile: 'Profil', welcome: 'Üdvözöl a SpotOn', withEmail: 'Email címmel', viewDetails: 'Részletek Megtekintése' },
  en: { explore: 'Explore', profile: 'Profile', welcome: 'Welcome to SpotOn', withEmail: 'With Email', viewDetails: 'View Details' },
} as const;

test.beforeEach(async ({ page }) => {
  await blockMapTiles(page);
});

for (const lang of ['hu', 'en'] as const) {
  test(`UI texts in ${lang}`, async ({ page }) => {
    const T = TEXT[lang];
    await skipFirstRunOverlays(page, lang);
    await openApp(page);

    await expect(page.getByRole('button', { name: T.explore, exact: true })).toBeVisible();

    // Seeded spot (T04): the info window's details button
    await spotMarker(page, E2E.legacySpot.emoji).click();
    await expect(page.getByRole('button', { name: T.viewDetails })).toBeVisible();

    // AuthModal (signed out)
    await page.goto('/');
    await openApp(page);
    await page.getByRole('button', { name: T.profile, exact: true }).click();
    await expect(page.getByRole('heading', { name: T.welcome })).toBeVisible();
    await expect(page.getByRole('button', { name: T.withEmail })).toBeVisible();
  });
}

test('first visit: LanguageSelector follows the tapped language', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('spoton-install-prompt-dismissed', 'true');
    window.localStorage.removeItem('spoton-language');
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Select Language' })).toBeVisible();
  await page.getByRole('button', { name: /Magyar/ }).click();
  await expect(page.getByRole('heading', { name: 'Válassz Nyelvet' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Folytatás' })).toBeVisible();
});

test('InstallGate keeps its rich-text DOM (hu, Android)', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.removeItem('spoton-install-prompt-dismissed');
    window.localStorage.setItem(
      'spoton-language',
      JSON.stringify({ state: { language: 'hu', hasSelectedLanguage: true }, version: 0 }),
    );
  });
  await page.goto('/');
  // innerHTML captured from the pre-T24 JSX (<strong> + &quot;) build
  await expect(page.locator('ol')).toHaveJSProperty(
    'innerHTML',
    '<li class="flex items-start gap-2"><span class="font-bold text-green-400 flex-shrink-0">1.</span>'
      + '<span>Kattints a <strong>három pontra</strong> (⋮) a böngésző jobb felső sarkában.</span></li>'
      + '<li class="flex items-start gap-2"><span class="font-bold text-green-400 flex-shrink-0">2.</span>'
      + '<span>Válaszd az <strong>"App telepítése"</strong> vagy <strong>"Kezdőképernyőre adás"</strong> gombot.</span></li>',
  );
});
