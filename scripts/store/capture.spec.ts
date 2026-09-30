import { expect, test, type Page } from '@playwright/test';
import { openApp, signInWithEmail, skipFirstRunOverlays } from '../../e2e/helpers';
import { featureGraphic, squareIcon } from './brand';
import { DEMO_PASSWORD, DEMO_USERS } from './demo-data';

// Store graphics and phone screenshots for Google Play and the web manifest (docs/play-store.md).
// Run with `npm run store:assets` (emulators + demo seed). Real map tiles are loaded on purpose.

const SCREENSHOTS = 'public/screenshots';
const STORE = 'docs/play-store';

test.describe.configure({ mode: 'serial' });

test('brand graphics', async ({ page }) => {
  const render = async (html: string, width: number, height: number, path: string) => {
    await page.setViewportSize({ width, height });
    await page.setContent(html);
    await page.screenshot({ path, omitBackground: false });
  };
  await render(squareIcon(512, false), 512, 512, `${STORE}/icon-512.png`);
  await render(squareIcon(192, true), 192, 192, 'public/icon-maskable-192x192.png');
  await render(squareIcon(512, true), 512, 512, 'public/icon-maskable-512x512.png');
  await render(featureGraphic('Discover and share places worth the trip'), 1024, 500, `${STORE}/feature-graphic.png`);
});

test.describe('phone screenshots (1080×1920, English)', () => {
  test.use({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });

  /** Waits for the visible map tiles and photos, then lets pins and cards finish their entry animations. */
  async function settle(page: Page) {
    await page
      .waitForFunction(() => [...document.images].every((img) => img.complete), undefined, { timeout: 20_000 })
      .catch(() => {});
    await page.waitForTimeout(1500);
  }

  const shot = (page: Page, name: string) =>
    page.screenshot({ path: `${SCREENSHOTS}/${name}.jpg`, type: 'jpeg', quality: 88 });

  test('map, place card, details, explore, profile', async ({ page }) => {
    await skipFirstRunOverlays(page, 'en');
    await openApp(page);
    await signInWithEmail(page, DEMO_USERS.anna.email, DEMO_PASSWORD);
    // One zoom step in, centred on the Castle District, so the pins stand apart.
    // (A wheel step over an empty stretch of map; a click could land on a pin.)
    await page.mouse.move(230, 250);
    await page.mouse.wheel(0, -240);
    await settle(page);
    await shot(page, '01-map');

    await page.locator('.leaflet-marker-icon:has(.spot-pin[data-category="scenic"])').first().click();
    await expect(page.getByText("Fisherman's Bastion terrace").first()).toBeVisible();
    await settle(page);
    await shot(page, '02-place-card');

    await page.getByRole('button', { name: 'Details', exact: true }).click();
    await expect(page.getByRole('heading', { name: "Fisherman's Bastion terrace" })).toBeVisible();
    await settle(page);
    await shot(page, '03-spot-details');

    const closePanel = async () => {
      await page.getByRole('button', { name: 'Close', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Explore', exact: true })).toBeVisible();
    };
    await closePanel();
    await page.getByRole('button', { name: 'Explore', exact: true }).click();
    await settle(page);
    await shot(page, '04-explore');

    await closePanel();
    await page.getByRole('button', { name: 'Profile' }).click();
    await settle(page);
    await shot(page, '05-profile');
  });
});
