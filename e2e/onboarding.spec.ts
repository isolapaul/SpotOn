import { expect, type Page } from '@playwright/test';
import { E2E, EXPECTED_APPROVED_MARKERS } from './fixtures';
import { adminDb } from './adminDb';
import { test, blockMapTiles, ONBOARDING_DONE, signInWithEmail } from './helpers';

// The first-run tour (lib/onboarding, components/onboarding): once per device for everyone, no
// global skip. Each test starts on a fresh device (Playwright context: empty localStorage).

type Lang = 'en' | 'hu' | 'de';

async function seedLanguage(page: Page, lang: Lang = 'en') {
  await page.addInitScript((l) => {
    window.localStorage.setItem('spoton-language', JSON.stringify({ state: { language: l, hasSelectedLanguage: true }, version: 0 }));
  }, lang);
}

const tour = (page: Page, name?: string) => (name ? page.getByRole('dialog', { name }) : page.locator('[role="dialog"][data-step]'));
/** The step on screen (the leaving one is inert and hidden from assistive tech). */
const current = (page: Page) => page.locator('[data-leaving="false"]');
const stepIs = (page: Page, step: string) => expect(tour(page)).toHaveAttribute('data-step', step);
const next = (page: Page) => current(page).getByRole('button', { name: 'Next', exact: true }).click();

async function openTour(page: Page, path = '/') {
  await page.goto(path);
  await expect(tour(page)).toBeVisible({ timeout: 30_000 });
}

/** Name step → (Next | later) → discover, share, levels → location answer → install → sign-up. */
async function walkToSignup(page: Page, opts: { name?: string; location?: 'allow' | 'skip' } = {}) {
  await current(page).getByRole('button', { name: "Let's go" }).click();
  await stepIs(page, 'name');
  if (opts.name) {
    await page.getByLabel('Username').fill(opts.name);
    await expect(page.getByText('This name is available')).toBeVisible();
    await current(page).getByRole('button', { name: 'Next', exact: true }).click();
  } else {
    await current(page).getByRole('button', { name: "I'll choose later" }).click();
  }
  for (const step of ['discover', 'add', 'levels']) {
    await stepIs(page, step);
    await next(page);
  }
  await stepIs(page, 'location');
  if (opts.location === 'skip') {
    await current(page).getByRole('button', { name: 'Not now' }).click();
    await expect(page.getByText('No problem. You can turn it on later in Settings.')).toBeVisible();
  } else {
    await current(page).getByRole('button', { name: 'Use my location' }).click();
    await expect(page.getByText("Done! Now you'll see what's near you.")).toBeVisible();
  }
  await next(page);
  await stepIs(page, 'install');
  await current(page).getByRole('button', { name: 'Not now' }).click();
  await stepIs(page, 'signup');
}

async function expectGone(page: Page, banner: string) {
  await expect(page.getByRole('status').filter({ hasText: banner })).toBeVisible();
  await expect(tour(page)).toHaveCount(0, { timeout: 10_000 });
  const stored = await page.evaluate((k) => window.localStorage.getItem(k), ONBOARDING_DONE.key);
  expect(JSON.parse(stored ?? '{}')).toMatchObject({ version: 1 });
}

test.beforeEach(async ({ page }) => {
  await blockMapTiles(page);
});

test('first visit: the whole tour with a name, then never again', async ({ page }) => {
  await seedLanguage(page);
  await openTour(page);
  await expect(tour(page, 'SpotOn tour')).toBeVisible();
  await expect(tour(page).getByRole('progressbar')).toHaveAttribute('aria-valuetext', 'Step 1 of 8');
  await expect(page.getByRole('heading', { name: "Find your city's hidden places" })).toBeVisible();
  // The tour is modal: the app behind it is inert.
  await expect(page.locator('main')).toHaveAttribute('inert', '');

  await walkToSignup(page, { name: 'tour_anna' });
  await expect(page.getByRole('heading', { name: 'Make it yours: @tour_anna' })).toBeVisible();
  // The sign-up step accepts the terms exactly as the sign-in sheet does (A1).
  await expect(current(page).getByText(/confirm that you are at least 16/)).toBeVisible();
  await expect(current(page).getByRole('link', { name: 'Terms of Use' })).toHaveAttribute('href', '/terms/en');
  await current(page).getByRole('button', { name: 'Just looking for now' }).click();
  await expectGone(page, 'Happy exploring, tour_anna!');
  // Location was allowed in the tour: the map has it.
  expect(await page.evaluate(() => sessionStorage.getItem('userLocation'))).not.toBeNull();

  await page.reload();
  await expect(page.getByRole('button', { name: 'Profile' })).toBeVisible({ timeout: 30_000 });
  await expect(tour(page)).toHaveCount(0);
});

test('"I\'ll choose later" and "Not now": no name later on, no automatic location request', async ({ page }) => {
  await seedLanguage(page);
  await openTour(page);
  await current(page).getByRole('button', { name: "Let's go" }).click();
  // A taken name is only a hint, but it cannot be carried on.
  await page.getByLabel('Username').fill(E2E.user.username);
  await expect(page.getByText('This username is already taken')).toBeVisible();
  await expect(current(page).getByRole('button', { name: 'Next', exact: true })).toBeDisabled();
  await page.getByLabel('Username').fill('ab');
  await expect(page.getByText('3–20 characters: a–z, 0–9 and _')).toBeVisible();
  await page.goto('/');
  await openTour(page);

  await walkToSignup(page, { location: 'skip' });
  await expect(page.getByRole('heading', { name: 'Save your favorite spots' })).toBeVisible();
  await current(page).getByRole('button', { name: 'Just looking for now' }).click();
  await expectGone(page, 'Happy exploring!');
  await page.waitForTimeout(1500);
  // "Not now" holds for the session: the map did not ask for (or get) the location.
  expect(await page.evaluate(() => sessionStorage.getItem('userLocation'))).toBeNull();
});

test('in the installed app there is no install step', async ({ page }) => {
  await seedLanguage(page);
  await page.addInitScript(() => {
    const original = window.matchMedia.bind(window);
    window.matchMedia = (query: string) =>
      query.includes('display-mode: standalone') ? ({ ...original(query), matches: true, media: query } as MediaQueryList) : original(query);
  });
  await openTour(page);
  // welcome, name, discover, share, levels, location, sign-up
  await expect(tour(page).getByRole('progressbar')).toHaveAttribute('aria-valuemax', '7');
});

test('the install step guides with the bold menu names (Android)', async ({ page }) => {
  await seedLanguage(page);
  await openTour(page);
  await current(page).getByRole('button', { name: "Let's go" }).click();
  await current(page).getByRole('button', { name: "I'll choose later" }).click();
  for (let i = 0; i < 3; i++) await next(page);
  await current(page).getByRole('button', { name: 'Not now' }).click();
  await next(page);
  await stepIs(page, 'install');
  const install = current(page).getByRole('button', { name: 'Install' });
  // Chromium may offer its own install dialog; otherwise the steps show.
  if (!(await install.isVisible())) {
    await expect(current(page).getByRole('heading', { name: 'Android (Chrome)' })).toBeVisible();
    await expect(current(page).locator('strong', { hasText: 'Install app' })).toBeVisible();
  }
});

test('a shared spot link opens the spot; the tour waits for the next visit', async ({ page }) => {
  await seedLanguage(page);
  await page.goto(`/spot/${E2E.legacySpot.id}`);
  await expect(page.getByTestId('loading-screen')).toHaveCount(0, { timeout: 30_000 });
  await expect(page.getByRole('button', { name: 'View details' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(E2E.legacySpot.name).first()).toBeVisible();
  await expect(tour(page)).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => location.pathname)).toBe('/');
  await openTour(page, '/');
});

test('a signed-in user sees the returning tour once, without the name and sign-up steps', async ({ page }) => {
  await seedLanguage(page);
  await page.addInitScript((done) => {
    if (!sessionStorage.getItem('signed-in')) window.localStorage.setItem(done.key, done.value);
  }, ONBOARDING_DONE);
  await page.goto('/');
  await signInWithEmail(page, E2E.user.email, E2E.password);
  await page.evaluate((k) => {
    sessionStorage.setItem('signed-in', '1');
    localStorage.removeItem(k);
  }, ONBOARDING_DONE.key);
  await openTour(page);

  await expect(page.getByText(`Welcome back, @${E2E.user.username}`)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'SpotOn has a new look' })).toBeVisible();
  await expect(tour(page).getByRole('progressbar')).toHaveAttribute('aria-valuemax', '6');
  await current(page).getByRole('button', { name: 'Show me' }).click();
  for (const step of ['discover', 'add', 'levels']) {
    await stepIs(page, step);
    await next(page);
  }
  await current(page).getByRole('button', { name: 'Not now' }).click();
  await next(page);
  await stepIs(page, 'install');
  await current(page).getByRole('button', { name: 'Not now' }).click();
  await expectGone(page, `All set, @${E2E.user.username}. Happy exploring!`);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Profile' })).toBeVisible({ timeout: 30_000 });
  await expect(tour(page)).toHaveCount(0);
});

test.describe('e-mail sign-up from the tour', () => {
  const email = `tour-${Date.now()}@spoton.test`;
  const username = `tour_${Date.now() % 1_000_000}`;

  test.afterAll(async () => {
    // Remove the account this test created (Auth emulator REST API with its admin token).
    const api = `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/projects/demo-spoton/accounts`;
    const call = (action: string, body: unknown) =>
      fetch(`${api}${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' }, body: JSON.stringify(body) });
    const found = (await (await call(':lookup', { email: [email] })).json()) as { users?: { localId: string }[] };
    const uid = found.users?.[0]?.localId;
    if (!uid) return;
    const db = adminDb();
    await Promise.all([db.doc(`users/${uid}`).delete(), db.doc(`publicProfiles/${uid}`).delete(), db.doc(`usernames/${username}`).delete()]);
    await call(':delete', { localId: uid });
  });

  test('carries the chosen username into the sign-up form and the account', async ({ page }) => {
    await seedLanguage(page);
    await openTour(page);
    await walkToSignup(page, { name: username });
    await current(page).getByRole('button', { name: 'Continue with email' }).click();
    // The sign-in sheet's own sign-up form, prefilled with the name from the tour.
    await expect(page.locator('#username')).toHaveValue(username);
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(E2E.password);
    await page.locator('form button[type="submit"]').click();
    await expectGone(page, `Happy exploring, ${username}!`);
    // The claim runs through the claimUsername callable: needs the functions emulator (CI).
    await expect.poll(async () => (await adminDb().doc(`usernames/${username}`).get()).exists, { timeout: 15_000 }).toBe(true);
  });
});

test('reduced motion: the tour completes with fades only', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seedLanguage(page);
  await openTour(page);
  await walkToSignup(page, { name: 'tour_still' });
  // The final state of the share step is shown at once (no burst, no pending flip).
  await current(page).getByRole('button', { name: 'Just looking for now' }).click();
  await expectGone(page, 'Happy exploring, tour_still!');
});

test('keyboard: focus stays in the tour, Enter and the arrow keys move through it; a swipe too', async ({ page }) => {
  await seedLanguage(page);
  await openTour(page);
  await expect(current(page).getByRole('button', { name: "Let's go" })).toBeFocused();
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true);
  }
  await current(page).getByRole('button', { name: "Let's go" }).focus();
  await page.keyboard.press('Enter');
  await stepIs(page, 'name');
  await expect(page.getByLabel('Username')).toBeFocused();
  // Without a confirmed name the arrow key cannot leave the name step.
  await page.keyboard.press('Escape');
  await page.getByLabel('Username').fill('tour_keys');
  await expect(page.getByText('This name is available')).toBeVisible();
  await page.keyboard.press('Enter');
  await stepIs(page, 'discover');
  await page.keyboard.press('ArrowRight');
  await stepIs(page, 'add');
  await page.keyboard.press('ArrowLeft');
  await stepIs(page, 'discover');
  // A horizontal drag (pointer events) is a swipe.
  const box = await tour(page).boundingBox();
  if (!box) throw new Error('no tour box');
  const y = box.y + box.height * 0.5;
  await page.mouse.move(box.x + box.width * 0.8, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.5, y, { steps: 6 });
  await page.mouse.move(box.x + box.width * 0.2, y, { steps: 6 });
  await page.mouse.up();
  await stepIs(page, 'add');
});

for (const [lang, t] of [
  ['hu', { dialog: 'A SpotOn bemutatója', title: 'Fedezd fel a város rejtett helyeit', progress: '1. lépés, összesen 8', start: 'Kezdjük' }],
  ['de', { dialog: 'SpotOn-Einführung', title: 'Versteckte Orte deiner Stadt', progress: 'Schritt 1 von 8', start: "Los geht's" }],
] as const) {
  test(`smoke in ${lang}`, async ({ page }) => {
    await seedLanguage(page, lang);
    await openTour(page);
    await expect(tour(page, t.dialog)).toBeVisible();
    await expect(page.getByRole('heading', { name: t.title })).toBeVisible();
    await expect(tour(page, t.dialog).getByRole('progressbar')).toHaveAttribute('aria-valuetext', t.progress);
    await current(page).getByRole('button', { name: t.start }).click();
    await stepIs(page, 'name');
  });
}

test('the language chip switches the tour language', async ({ page }) => {
  await seedLanguage(page, 'hu');
  await openTour(page, '/');
  await page.getByRole('button', { name: 'Nyelv módosítása, most: Magyar' }).click();
  await page.getByRole('menuitemradio', { name: /Deutsch/ }).click();
  await expect(page.getByRole('heading', { name: 'Versteckte Orte deiner Stadt' })).toBeVisible();
  await expect(tour(page, 'SpotOn-Einführung')).toBeVisible();
});

test('the map is ready after the tour (it loaded underneath all along)', async ({ page }) => {
  await seedLanguage(page);
  await openTour(page);
  await walkToSignup(page, { location: 'skip' });
  await current(page).getByRole('button', { name: 'Just looking for now' }).click();
  await expect(tour(page)).toHaveCount(0, { timeout: 10_000 });
  // Without the location the map stays zoomed out: the approved spots are one cluster.
  await expect(page.locator('.spot-cluster, .spot-marker').first()).toBeAttached();
  await expect(page.getByRole('button', { name: 'Explore' })).toContainText(String(EXPECTED_APPROVED_MARKERS));
});
