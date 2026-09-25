# T19 — Domain-move notice (Vercel only), then the 308

**Phase:** 3 · **Depends on:** T17 (new domain live), T04 (e2e) · **Risk:** low · **Decisions:** D5
**Audit refs:** — (ROADMAP trap 3: per-origin state resets)

## Goal
Tell people still using the old Vercel address, once and calmly, that SpotOn now lives at `spoton.isolapaul.hu` and that they should save the new link. Then, in Stage B, permanently redirect with a 308.

Paul's words, which are binding: *"308 redirect, but please show it somehow on the app that they need to save this new link. Be careful how you do it, I really dont want to open up the app and see 5 pop ups. Do not make it an AI slop."*

So the notice is:
- a single slim banner, not a modal, and never blocking the map;
- no emoji, no gradient or glow, no exclamation marks, no marketing tone;
- the only thing asking for attention on the old domain.

## Context
- The banner exists only in the **Vercel** build: `NEXT_PUBLIC_MOVED_TO` is set only there (CLAUDE.md env table). The Docker build cannot receive it: T16's Dockerfile has no such ARG, and `check-public-env.mjs --production` rejects it.
- Other things that can appear on app open, all verified:
  - `InstallGate` (`src/app/layout.tsx:49`; `src/components/InstallGate.tsx:63-85`): a full-screen `z-[9999]` overlay for every non-standalone visitor who has not ticked "don't show again". On the old domain it would ask people to install the **old** origin, which is wrong. **Decision: suppress it when `NEXT_PUBLIC_MOVED_TO` is set.**
  - `LanguageSelector` (`page.tsx:288`; `LanguageSelector.tsx:216-237`): a modal while `!useLanguageStore.hasSelectedLanguage`. It stays, because first-time visitors must still choose a language. The banner waits until it is closed.
  - `NotificationPrompt` (`page.tsx:268`; `NotificationPrompt.tsx:395-422`): a `top-20 z-50` card, 3 s after load, for signed-in users with permission `default`. Push tokens are per-origin, so enabling push on the old origin is pointless. **Decision: never show it when `NEXT_PUBLIC_MOVED_TO` is set.**
  - `UsernameSetupModal` (`page.tsx:323`): needed for new sign-ups. It is left as is.
- Top chrome layout:
  - Bell and feedback buttons: `fixed z-[1500] w-12 h-12`, `top: calc(1rem + env(safe-area-inset-top))`, left `max(1rem, env(safe-area-inset-left))` and `+56px` (`NotificationCenter.tsx:66-106`).
  - Theme button: same top, `right: max(1rem, env(safe-area-inset-right))` (`MapThemeSwitcher.tsx:28-42`).
  - These render only when `!profilePanelOpen && !discoveryPanelOpen && !selectedSpot` (`page.tsx:271`).
  - Below them at `top-20 z-10` sit the empty-state pill (`page.tsx:361-368`) and the location-selection card (`page.tsx:371-385`).
  - Panels and modals use `z-[2000]` and up.
  - The button style is `bg-black/40 backdrop-blur-md border border-white/10 shadow-glass-lg`. Global CSS forces a 44 px minimum on `button`/`a` (`globals.css:61-70`).
- `useUiStore` (`src/store/useUiStore.ts`) holds UI flags. T03 may have removed `notificationPromptVisible`; add the new flag regardless.
- Vercel `vercel.json` `redirects[].permanent: true` → **308** (false/default → 307). Confirmed by the Vercel docs via search; vercel.com itself was not reachable from the sandbox. `vercel.json` is read only by Vercel. Docker and `next build` ignore it, and T16's `.dockerignore` excludes it anyway.

## Files
- Create:
  - `src/components/MovedBanner.tsx`
  - `src/lib/movedTo.ts`, `src/lib/movedTo.test.ts`
  - `e2e/moved-banner.spec.ts` (follow T04's layout)
  - `deploy/vercel-stage-b.json`
  - `docs/screenshots/moved-banner-hu.png`, `docs/screenshots/moved-banner-en.png` (generated)
- Modify:
  - `src/app/page.tsx` (render the banner; hide the empty-state pill while it shows)
  - `src/store/useUiStore.ts`
  - `src/components/InstallGate.tsx` (effect guard only)
  - `src/components/NotificationPrompt.tsx` (guard only)
  - `src/lib/translations.ts`
  - `docs/deploy.md` (append the section "Leaving Vercel")

## Steps
1. **`src/lib/movedTo.ts`** (pure):
   ```ts
   export const MOVED_BANNER_DISMISS_KEY = 'spoton-moved-banner-dismissed-at';
   export const MOVED_BANNER_SNOOZE_MS = 3 * 24 * 60 * 60 * 1000;
   export function parseMovedTo(raw: string | undefined): URL | null      // https only, else null
   export function getMovedTo(): URL | null { return parseMovedTo(process.env.NEXT_PUBLIC_MOVED_TO); }
   export function isBannerSnoozed(dismissedAt: string | null, now: number): boolean  // true if 0 <= now-ts < SNOOZE
   export function movedTarget(base: URL, pathname: string, search: string): string  // new URL(pathname+search, base).href
   ```
   Write `process.env.NEXT_PUBLIC_MOVED_TO` literally, so that Next inlines it.
2. **`useUiStore`.** Add `movedBannerVisible: boolean` (default `false`) and `setMovedBannerVisible(v)`.
3. **`MovedBanner.tsx`** (`'use client'`):
   - Render `null` unless all of these hold:
     - `getMovedTo()` is non-null;
     - `hasSelectedLanguage` is true;
     - the banner is mounted (client) and the snooze check has passed.
   - On mount, read `localStorage[MOVED_BANNER_DISMISS_KEY]` inside `try/catch`. On error, treat it as not dismissed.
   - Sync `setMovedBannerVisible(visible)` in an effect, with cleanup back to `false`.
   - Detect standalone mode with the same test InstallGate uses (`matchMedia('(display-mode: standalone)')` or `navigator.standalone`) to choose the hint line.
   - Markup (static Tailwind classes):
     ```tsx
     <div role="status" aria-live="polite"
       className="fixed z-[1500] mx-auto max-w-md flex items-center gap-2 pl-4 pr-1 py-1
                  rounded-2xl bg-black/60 backdrop-blur-md border border-white/10 shadow-glass-lg text-white animate-fade-in"
       style={{ top: 'calc(1rem + env(safe-area-inset-top) + 56px)',
                left: 'max(1rem, env(safe-area-inset-left))', right: 'max(1rem, env(safe-area-inset-right))' }}>
       <p className="flex-1 min-w-0 py-1 text-sm leading-snug">
         {t('movedBannerText')} <span className="font-semibold whitespace-nowrap">{movedTo.host}</span>
         <span className="block text-xs text-white/70">{standalone ? t('movedBannerHintInstalled') : t('movedBannerHint')}</span>
       </p>
       <a href={movedTarget(movedTo, location.pathname, location.search)} rel="noopener"
          className="shrink-0 px-3 rounded-xl bg-white/15 hover:bg-white/25 text-sm font-medium touch-manipulation">
         {t('movedBannerOpen')}</a>
       <button type="button" onClick={dismiss} aria-label={t('movedBannerDismiss')}
          className="shrink-0 rounded-full hover:bg-white/10 touch-manipulation">
         <X className="w-4 h-4 text-white/70" strokeWidth={2} /></button>
     </div>
     ```
     - `bg-black/60` is used instead of the buttons' `/40` for text contrast over light map tiles.
     - Width: full width minus the safe-area margins, capped at `max-w-md` and centred.
     - It sits one row (56 px) below the top buttons, above the map (`z-[1500]`), and below every panel and modal (`z-[2000]`+).
     - No icon other than the close ×, and the link opens in the same tab.
   - `dismiss()`: write `String(Date.now())` in `try/catch`, then hide.
4. **`page.tsx`:**
   - Render `{isAppReady && !isSelectingLocation && <MovedBanner />}` inside the existing top-buttons condition block (`page.tsx:271-279`). The banner then hides whenever a panel covers the screen, and during location picking.
   - Hide the empty-state pill while `useUiStore.movedBannerVisible` is true (they share the same vertical slot).
5. **Guards:**
   - `InstallGate.tsx`: first line of the effect, `if (getMovedTo()) { setShowPrompt(false); return; }`.
   - `NotificationPrompt.tsx`: first line of `checkPrompt`, `if (getMovedTo()) return;`.
   - Do not add hooks conditionally, and change nothing else in either component.
6. **Translations.** Add all keys in hu, en and de. This is the final copy; use it verbatim.

   | key | hu | en | de |
   |---|---|---|---|
   | `movedBannerText` | A SpotOn új címre költözött: | SpotOn has a new address: | SpotOn hat eine neue Adresse: |
   | `movedBannerHint` | Mentsd el az új linket. Ott egyszer újra be kell jelentkezned. | Save the new link. You'll need to sign in there once. | Speichere den neuen Link. Dort musst du dich einmal neu anmelden. |
   | `movedBannerHintInstalled` | Tedd ki újra a SpotOnt a kezdőképernyőre. Ott egyszer újra be kell jelentkezned. | Add SpotOn to your home screen again. You'll need to sign in there once. | Füge SpotOn erneut zum Home-Bildschirm hinzu. Dort musst du dich einmal neu anmelden. |
   | `movedBannerOpen` | Megnyitás | Open | Öffnen |
   | `movedBannerDismiss` | Elrejtés | Hide | Ausblenden |
7. **Unit tests (`movedTo.test.ts`):**
   - `parseMovedTo`: `undefined`, `''`, `'http://x'` and `'not a url'` give null; `'https://spoton.isolapaul.hu'` gives a URL.
   - `isBannerSnoozed`: `null` → false; now → true; now − 3 d + 1 ms → true; now − 3 d → false; a future timestamp → false; `'abc'` → false.
   - `movedTarget` keeps the path and query.
8. **`e2e/moved-banner.spec.ts`.** Use a 390×844 viewport (deviceScaleFactor 2). Seed `localStorage['spoton-language']` = `{"state":{"language":"hu","hasSelectedLanguage":true},"version":0}` (or `en`) with `addInitScript`.
   - When `process.env.NEXT_PUBLIC_MOVED_TO` is set:
     - the banner (`getByRole('status')` containing `spoton.isolapaul.hu`) is visible;
     - the Open link `href` starts with the env value;
     - screenshot the full page to `docs/screenshots/moved-banner-${lang}.png` for hu and en;
     - no InstallGate text ("SpotOn Élmény" / "SpotOn Experience") is present;
     - click Hide → the banner is gone; reload → still gone; `localStorage[key]` is set;
     - set the key to `Date.now() - 3*864e5 - 1000` and reload → the banner is back.
   - Otherwise: `expect(page.getByText('spoton.isolapaul.hu')).toHaveCount(0)`.
9. **`deploy/vercel-stage-b.json`:**
   ```json
   {
     "$schema": "https://openapi.vercel.sh/vercel.json",
     "redirects": [
       { "source": "/(.*)", "destination": "https://spoton.isolapaul.hu/$1", "permanent": true }
     ]
   }
   ```
10. **`docs/deploy.md` — append the section "Leaving Vercel"** (Paul's steps):
    - **Stage A** (only after the T17 post-deploy checklist is green on the new domain): Vercel → Project → Settings → Environment Variables → add `NEXT_PUBLIC_MOVED_TO` = `https://spoton.isolapaul.hu` (Production only) → Deployments → Redeploy. It is a build-time variable; setting it without a redeploy does nothing. Keep Vercel's `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` on `<project>.firebaseapp.com`.
      - Check: open `https://spot-on-rho.vercel.app` → one banner and no install overlay.
    - **Stage B** (~30 days later): `cp deploy/vercel-stage-b.json vercel.json`, commit, push the branch Vercel deploys.
      - Check: `curl -sI 'https://spot-on-rho.vercel.app/some/path?x=1'` → `HTTP/2 308` and `location: https://spoton.isolapaul.hu/some/path?x=1`.
      - `vercel.json` has no effect on the Docker image.
      - A 308 is cached by browsers, so treat it as irreversible.
      - Old installed PWAs follow the redirect on launch.
      - Push tokens for the old origin keep working until pruned; clicking such a notification opens the old URL, which redirects.
    - **Stage C** (~90 days after B): delete the Vercel project; remove `vercel.json`, `deploy/vercel-stage-b.json`, `MovedBanner`, `movedTo.ts`, the guards and the keys in a cleanup task.

## Must NOT change
- The container / Docker build: the banner is absent there, and InstallGate and NotificationPrompt behave exactly as before.
- InstallGate, LanguageSelector and NotificationPrompt markup and texts.
- Top-button positions, and every panel and modal.
- No new modal, toast or notification. There is exactly **one** banner on the old domain.

## Acceptance
```bash
npm run verify
npx vitest run src/lib/movedTo.test.ts
grep -nE "movedBanner[A-Za-z]*: ['\"].*!" src/lib/translations.ts && exit 1 || true          # no exclamation marks in copy
grep -nE "gradient|glow|animate-(pulse|bounce|ping)|[\x{1F300}-\x{1FAFF}]" -P src/components/MovedBanner.tsx && exit 1 || true
node -e "const j=require('./deploy/vercel-stage-b.json'); if(j.redirects[0].permanent!==true) process.exit(1)"
test ! -e vercel.json
# with banner
NEXT_PUBLIC_MOVED_TO=https://spoton.isolapaul.hu npm run test:e2e -- e2e/moved-banner.spec.ts
ls -l docs/screenshots/moved-banner-hu.png docs/screenshots/moved-banner-en.png
# without banner (normal build) — full smoke must stay green
npm run test:e2e
```
The acceptance needs T04's harness to pass `NEXT_PUBLIC_MOVED_TO` through to its build. If it does not, add that pass-through in the Playwright `webServer` env, and state it in the commit.

Manual checks by the reviewer and Paul, on the screenshots:
- one line of text plus the muted hint;
- no overlap with the top buttons on a notched viewport;
- the map stays usable;
- nothing else pops up.

## Rollback
- Stage A: remove the Vercel env var and redeploy, or `git revert`.
- Stage B: delete `vercel.json` and redeploy. Browsers that cached the 308 keep redirecting, which is the reason for the 30-day gap.

## Stop and ask Paul if…
- He does **not** want InstallGate or NotificationPrompt suppressed on the old domain. Both are decisions made in this spec to honour "no 5 pop-ups".
- The copy needs changes (show him the two screenshots).
- The banner would need to appear somewhere other than below the top button row, for example because of a conflict with an element added after T19 was written.
