# T32 — Nonce-based strict CSP

**Phase:** 6 · **Depends on:** T15, T31 · **Risk:** med · **Decisions:** D6, D7
**Audit refs:** SEC-12

## Goal
Remove `'unsafe-inline'` from `script-src` in production. Each page request gets a fresh nonce from a Next 16 **proxy**, and the CSP uses `'nonce-…' 'strict-dynamic'`. Only scripts that Next emits with the nonce, and the scripts they load, can run. Google sign-in, the FCM service worker, Leaflet and the emulator test build must keep working, and Playwright must see zero CSP violations.

## Context
- **Next 16 naming, verified** against the Next.js docs at tag `v16.3.6` (`docs/01-app/03-api-reference/03-file-conventions/proxy.mdx` and `docs/01-app/02-guides/content-security-policy.mdx`):
  - The `middleware` file convention is **deprecated and renamed to `proxy`**: the file is `proxy.ts`, and it exports `export function proxy(request: NextRequest)`.
  - The file goes "in the project root, or inside `src` if applicable, … at the same level as `app`". Here that is **`src/proxy.ts`**.
  - Proxy **defaults to the Node.js runtime**. The `runtime` config option is not allowed in proxy files and throws an error.
  - Next reads the nonce from the **request** `Content-Security-Policy` header (the `'nonce-{value}'` pattern) during SSR, and applies it automatically to framework scripts, page bundles, and inline scripts and styles that Next generates.
  - Nonces require **dynamic rendering**. Static or prerendered pages have no nonce. The docs force this with `await connection()` from `next/server`, or by reading `headers()`. PPR is incompatible.
  - `'unsafe-eval'` is needed **in development only**.
  - The recommended matcher excludes `api`, `_next/static`, `_next/image`, `favicon.ico` and prefetch requests (`next-router-prefetch`, `purpose: prefetch`).
- **Current state after T15** (read `docs/tasks/T15-web-hardening.md` and the code):
  - `next.config.mjs` has a top-level `buildCsp()` (reading `isDev = NODE_ENV !== 'production'` and `useEmulators`). It is applied by `headers()` to `source: '/:path((?!__/auth/|__/firebase/).*)'` together with the other security headers. `/__/:path*` gets only HSTS, nosniff and Referrer-Policy.
  - Production `script-src 'self' 'unsafe-inline' https://apis.google.com https://www.gstatic.com`; `style-src 'self' 'unsafe-inline'`; and `upgrade-insecure-requests` only when neither dev nor emulators.
  - `/__/auth/:path*` and `/__/firebase/:path*` are **`rewrites()`** to `https://<projectId>.firebaseapp.com`. They are disabled in emulator builds. There is **no** `proxy.ts`.
  - `scripts/check-headers.sh` asserts the exact CSP strings, and `e2e/csp.spec.ts` asserts zero violations on the smoke flow. Both exist and must be updated, not duplicated.
- **Pages:** `src/app/layout.tsx` (server component; renders `<InstallGate/>` and children) and `src/app/page.tsx` (`'use client'`). There is no `next/script`, no inline `<script>`, and no `dangerouslySetInnerHTML` (T15).
- **Service worker:** `src/app/api/firebase-messaging-sw/route.ts` serves the FCM worker. It calls `importScripts('https://www.gstatic.com/firebasejs/…')`. A worker's CSP comes from **its own response headers**, so the `/api/*` path keeps a static policy that allows gstatic.
- **Inline styles:** Leaflet sets styles through the CSSOM, which CSP does not govern. But `next/image` `fill` and React `style={…}` produce **`style=` attributes in SSR HTML**, and those need `'unsafe-inline'` in `style-src`.
- **CSP rule to keep in mind:** if a directive contains a nonce or hash, browsers **ignore `'unsafe-inline'`** in it. So `style-src` must **not** get a nonce. It keeps `'self' 'unsafe-inline'` exactly as in T15. **This is a deliberate deviation from the Next docs sample, which nonces `style-src`.** Styles cannot execute script; the risk accepted is CSS injection only.
- **Google sign-in (D6):**
  - `signInWithPopup` opens `https://<authDomain>/__/auth/handler` (authDomain = the own domain after T15) in a popup, and loads `https://apis.google.com/js/api.js` plus an iframe `/__/auth/iframe`.
  - Under `'strict-dynamic'`, a script loaded by a nonced script is trusted, and host allowlists in `script-src` are **ignored** by CSP3 browsers. Keep them anyway as a CSP2 fallback.
  - The `/__/auth/*` and `/__/firebase/*` responses are rewritten to `<project>.firebaseapp.com` and carry inline scripts of their own. **They must not get our CSP** (T15 already excludes them from `headers()`), so the proxy matcher must exclude `__/` as well.

## Files
- Create: `src/proxy.ts`, `src/lib/csp.mjs` (pure policy builder as an ES module with JSDoc types, so both `next.config.mjs` and `proxy.ts` can import it), `src/lib/csp.test.ts`.
- Modify:
  - `next.config.mjs`: import `buildCsp` from `./src/lib/csp.mjs` (delete the inline copy); page routes no longer get a CSP from `headers()`; keep all other headers and the rewrites.
  - `src/app/layout.tsx`: force dynamic rendering.
  - `scripts/check-headers.sh`: page CSP is now nonce-based (pattern match); `/api/*` keeps the exact T15 string.
  - `e2e/csp.spec.ts` (T15): extend it.
- Modify: `docs/deploy.md` if it exists (T17), adding one note: pages are now dynamically rendered; container sizing is unchanged, because there is a single page route.

## Steps
1. **`src/lib/csp.mjs`:** move T15's builder here, as `buildCsp({ nonce, isDev, useEmulators }): string`.
   - With `nonce` **null** it must return T15's string **byte-for-byte**, including `'unsafe-inline'`. That is the static policy kept for `/api/*`: the FCM worker needs `importScripts` from gstatic, and a worker takes its CSP from its own response.
   - With a `nonce`, `script-src` becomes `'self' 'nonce-${nonce}' 'strict-dynamic' https://apis.google.com https://www.gstatic.com`, plus `'unsafe-eval'` iff `isDev`. **No `'unsafe-inline'`.**
   - `style-src` stays `'self' 'unsafe-inline'` with **no nonce** (see Context).
   - Every other directive, the emulator additions and the `upgrade-insecure-requests` rule stay exactly as in T15.
   - Tests:
     - `buildCsp({ nonce: null, … })` equals the three T15 strings (production, dev, emulator) verbatim;
     - with a nonce: the nonce appears exactly once, in `script-src`; `script-src` has no `'unsafe-inline'`; `'unsafe-eval'` appears iff `isDev`; `style-src` has no nonce.
2. **`src/proxy.ts`**:
   ```ts
   import { NextRequest, NextResponse } from 'next/server';
   import { buildCsp } from '@/lib/csp.mjs';
   export function proxy(request: NextRequest) {
     const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
     const csp = buildCsp({ nonce, isDev: process.env.NODE_ENV !== 'production', useEmulators: process.env.NEXT_PUBLIC_USE_EMULATORS === '1' }); // same isDev rule as T15
     const requestHeaders = new Headers(request.headers);
     requestHeaders.set('x-nonce', nonce);
     requestHeaders.set('Content-Security-Policy', csp);
     const response = NextResponse.next({ request: { headers: requestHeaders } });
     response.headers.set('Content-Security-Policy', csp);
     return response;
   }
   export const config = {
     matcher: [{
       source: '/((?!api/|_next/static|_next/image|__/|favicon.ico|manifest.json|icon-|placeholder-spot.jpg|patch-notes.md).*)',
       missing: [{ type: 'header', key: 'next-router-prefetch' }, { type: 'header', key: 'purpose', value: 'prefetch' }],
     }],
   };
   ```
   The `__/` exclusion is mandatory. Do not export `runtime`. Rewrites run **after** proxy, and the excluded paths never reach it.
3. **`next.config.mjs` `headers()`:**
   - Remove `Content-Security-Policy` from T15's `'/:path((?!__/auth/|__/firebase/).*)'` entry. Keep the other headers there.
   - Add an entry `source: '/api/:path*'` with `Content-Security-Policy: buildCsp({ nonce: null, isDev, useEmulators })`, so the worker keeps T15's exact policy.
   - Static public files (`manifest.json`, icons, `_next/static`) get no CSP; a CSP on non-document responses has no effect anyway.
   - Keep `/__/:path*` headers and the rewrites unchanged.
4. **Dynamic rendering:** make `RootLayout` `async` and call `await connection()` (from `next/server`) as its first line. Do not use the nonce manually: Next applies it. Confirm that `next build` lists `/` as dynamic (`ƒ`), not static (`○`).
5. **Verify in `next build && next start`** (production mode, emulator build per T04):
   - `curl -sI localhost:3000/ | grep -i content-security-policy` shows a nonce, and two requests give different nonces.
   - Every `<script>` in the HTML has a `nonce` attribute: `curl -s localhost:3000/ | grep -o '<script[^>]*>' | grep -vc nonce` → `0`.
   - `curl -sI localhost:3000/api/firebase-messaging-sw` → the static API policy.
   - `scripts/check-headers.sh` (updated) passes: `/` has a nonce policy; `/api/firebase-messaging-sw` has the exact T15 string; `/__/auth/handler` has no CSP and no `X-Frame-Options`.
6. **E2E `e2e/csp.spec.ts`** (extend T15's spec, keeping its existing flow):
   - `page.addInitScript(() => { (window as any).__csp = []; document.addEventListener('securitypolicyviolation', e => (window as any).__csp.push(`${e.violatedDirective} ${e.blockedURI}`)); })`, and also collect `page.on('console')` messages matching `/Content Security Policy/i`.
   - Flows:
     1. Load the app; wait for markers.
     2. Switch the map theme (standard → satellite → dark).
     3. Open the info window and details; open the gallery.
     4. Open AuthModal and sign in with email against the emulator.
     5. Open the profile and settings.
     6. Register the service worker: call `navigator.serviceWorker.register('/api/firebase-messaging-sw')` in `page.evaluate` and assert that the `register()` promise **settles** (resolves or rejects) within 10 s. Do **not** await `navigator.serviceWorker.ready`: the worker's `importScripts` from gstatic may be blocked in the sandbox, so activation may never happen. Additionally (or instead, if registration is unavailable) fetch `/api/firebase-messaging-sw` and assert its `Content-Security-Policy` header equals the static T15 API policy.
   - Assert `__csp` is empty and there are no CSP console messages.
   - Assert that the response CSP of `/` contains `'strict-dynamic'`, contains `nonce-`, and has no `'unsafe-inline'` in the `script-src` segment.
   - Google popup sign-in cannot run against the emulator. Document the manual check below.
7. **Manual checks** on a staging build with real Firebase config (Paul): Google sign-in popup (and the redirect fallback), push permission plus token, and a foreground and background notification. Check that the browser console shows no CSP errors.
   - **Cloudflare** (the zone in front of the tunnel): features that inject scripts into HTML must be **off** or nonce-compatible, or they break under `'strict-dynamic'`: Bot Fight Mode / JavaScript Detections, Web Analytics automatic injection, Zaraz and Rocket Loader.
   - HTML must **not** be edge-cached (no "Cache Everything" page rule or cache rule on `/`): a cached page would replay one nonce to every visitor. Confirm with `curl -sI https://spoton.isolapaul.hu/` twice → different nonces, and `cf-cache-status` is not `HIT`.

## Must NOT change
- Every non-CSP security header from T15 (COOP `same-origin-allow-popups`, HSTS, nosniff, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-XSS-Protection: 0`).
- `img-src`, `connect-src`, `frame-src` and `worker-src` host lists (only `script-src` changes).
- `/__/auth/*` proxying and the Google sign-in flow; the FCM service-worker URL, scope and headers.
- App behaviour and UI.

## Acceptance
```bash
npm run verify
npx vitest run src/lib/csp.test.ts   # includes byte-equality with T15's three strings for nonce=null
npm run build 2>&1 | tee /tmp/build.log; grep -E "^\S+\s+[○●]\s+/\s*$" /tmp/build.log   # → no output: route "/" must be listed as ƒ (Dynamic)
grep -E "ƒ\s+/\s*$" /tmp/build.log                             # → exactly one line (positive check: "/" is dynamic)
npm run test:e2e                                              # includes csp.spec.ts: zero violations
npm run build && npm start &   # emulator build per T04; then:
curl -sI localhost:3000/ | grep -i "^content-security-policy" | grep -o "script-src[^;]*" | grep -c "unsafe-inline"   # → 0
bash scripts/check-headers.sh
test -f src/proxy.ts && ! test -f src/middleware.ts && ! test -f middleware.ts
```
Plus the curl checks from step 5, recorded in the commit body.

## Rollback
`git revert`. This restores the static T15 CSP and static rendering. No data implications.

## Stop and ask Paul if…
- Any required third-party script (Firebase Auth, the reCAPTCHA if ever enabled, a Google Identity Services iframe) is blocked and fixing it needs `'unsafe-inline'`, `'unsafe-eval'` in production, or a broad host wildcard.
- Next 16.3 renders a page statically despite `connection()`, or reports that nonce CSP is incompatible with a config T16 uses (`output: 'standalone'` is compatible; PPR or `cacheComponents` is not).
- The staging Google sign-in popup fails because of the auth proxy and CSP interaction.
