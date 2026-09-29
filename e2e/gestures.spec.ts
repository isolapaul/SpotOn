import { expect, type Page } from '@playwright/test';
import { E2E } from './fixtures';
import { test, blockMapTiles, openApp, skipFirstRunOverlays, spotMarker } from './helpers';

// Owner feedback (device test): panels close with a careful pull down, never sideways; the place
// card's grabber opens the details. Read-only.

test.use({ hasTouch: true, viewport: { width: 393, height: 852 } });

test.beforeEach(async ({ page }) => {
  await skipFirstRunOverlays(page);
  await blockMapTiles(page);
});

/** A one-finger drag on the element under (x, y0) to (x1, y1), as native touch events. */
async function touchDrag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, steps = 8) {
  await page.evaluate(
    async ({ from, to, steps }) => {
      const target = document.elementFromPoint(from.x, from.y)!;
      const touch = (x: number, y: number) =>
        new Touch({ identifier: 1, target, clientX: x, clientY: y, pageX: x, pageY: y });
      const fire = (type: string, x: number, y: number) =>
        target.dispatchEvent(
          new TouchEvent(type, {
            bubbles: true,
            cancelable: true,
            touches: type === 'touchend' ? [] : [touch(x, y)],
            changedTouches: [touch(x, y)],
          }),
        );
      fire('touchstart', from.x, from.y);
      for (let i = 1; i <= steps; i++) {
        await new Promise((r) => setTimeout(r, 16));
        fire('touchmove', from.x + ((to.x - from.x) * i) / steps, from.y + ((to.y - from.y) * i) / steps);
      }
      fire('touchend', to.x, to.y);
    },
    { from, to, steps },
  );
}

const discovery = (page: Page) => page.getByLabel('Close discovery panel');

test('a panel ignores a sideways swipe and a small pull, and closes on a real pull down', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: 'Explore', exact: true }).click();
  await expect(discovery(page)).toBeVisible();

  await touchDrag(page, { x: 60, y: 300 }, { x: 330, y: 310 });
  await page.waitForTimeout(500);
  await expect(discovery(page)).toBeVisible();

  await touchDrag(page, { x: 200, y: 300 }, { x: 200, y: 380 }, 10);
  await page.waitForTimeout(500);
  await expect(discovery(page)).toBeVisible();

  await touchDrag(page, { x: 200, y: 300 }, { x: 200, y: 620 }, 12);
  await expect(discovery(page)).toHaveCount(0);
});

test('the place card grabber opens the spot details', async ({ page }) => {
  await openApp(page);
  await spotMarker(page, E2E.detailsSpot.category).click();
  await page.getByRole('button', { name: 'Details', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Close spot details' })).toBeVisible();
});
