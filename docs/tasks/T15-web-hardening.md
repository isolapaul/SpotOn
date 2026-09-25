# T15 — Web hardening (CSP, headers, auth proxy, innerHTML, assets)

**Phase:** 2 · **Depends on:** T06 (Firebase SDK 12, SW `importScripts` version), T04 (e2e harness) · **Risk:** med · **Decisions:** D6, D7 (T32 does nonces later)
**Audit refs:** SEC-12, SEC-15, SEC-20 (assets and headers), BUG-08

## Goal
Production gets a tight Content-Security-Policy, built from the hosts the app really uses, plus modern security headers. Sign-in runs through a `/__/auth/*` proxy, so `authDomain` can be `spoton.isolapaul.hu` (D6), which makes Google redirect sign-in work in browsers that block third-party storage. The avatar `innerHTML` fallback is removed, and the missing assets are no longer referenced.

## Context
- `next.config.mjs`:
  - :24-31 is today's CSP: `'unsafe-eval'` in production, `img-src https: http:`, unused `*.firebaseio.com` / `fonts.googleapis.com` / `tile.openstreetmap.fr` / `*.google.com`, and no `object-src`, `base-uri`, `form-action` or `frame-ancestors`.
  - :44 sends `X-XSS-Protection: 1; mode=block`.
  - There are no `rewrites()` and no `poweredByHeader`.
  - :4 has `images.unoptimized` true in production, so `<Image>` loads remote URLs directly, and `img-src` must list those hosts.
- **Hosts actually used** (verified with grep over `src/`):
  - Tiles, from `src/store/useMapThemeStore.ts:26-42`: `{s}.tile.openstreetmap.org` (a/b/c), `{s}.basemaps.cartocdn.com` (a–d), `server.arcgisonline.com`. These are `<img>` loads.
  - Images: `firebasestorage.googleapis.com` (Storage download URLs) and `lh3.googleusercontent.com` (Google avatars; allow `*.googleusercontent.com`).
  - Firebase JS SDK network calls: `identitytoolkit.googleapis.com`, `securetoken.googleapis.com`, `firestore.googleapis.com`, `firebasestorage.googleapis.com`, `firebaseinstallations.googleapis.com`, `fcmregistrations.googleapis.com` and `fcm.googleapis.com` are all covered by `https://*.googleapis.com`. Callables use `https://europe-west3-<project>.cloudfunctions.net`.
  - Google sign-in: the SDK loads `https://apis.google.com/js/api.js`, then an iframe from `<authDomain>/__/auth/iframe`, and opens a popup or redirect to `<authDomain>/__/auth/handler`. Popups are not governed by the opener's CSP.
  - Service worker `src/app/api/firebase-messaging-sw/route.ts:14-15`: `importScripts('https://www.gstatic.com/firebasejs/<ver>/…-compat.js')`. **A service worker is governed by the CSP header on its own script response.** The global header applies to `/api/firebase-messaging-sw`, so `script-src` must contain `https://www.gstatic.com`, and `connect-src` must contain `*.googleapis.com`.
  - Nothing uses Google Fonts, the Realtime Database or `next/font`.
  - `leaflet/dist/leaflet.css` images are bundled to `/_next/static` ('self').
- `browser-image-compression` defaults to a web worker that `importScripts()` from `cdn.jsdelivr.net`, which is blocked, with a main-thread fallback.
  - `src/components/SettingsPanel.tsx:53,:81` set `useWebWorker: true`.
  - T14 already set `useWebWorker: false` in FeedbackPanel.
  - The stores use `false` (`useSpotStore.ts:111`, `useUserStore.ts:79`).
- Test builds: T04 builds with `NEXT_PUBLIC_USE_EMULATORS=1` and talks to emulators on `http://127.0.0.1:{8080,9099,9199,5001}`.
  - Those builds must allow them.
  - `upgrade-insecure-requests` must be **off** there: it would upgrade `http://` emulator and localhost sub-resources.
- `headers()` and `rewrites()` are evaluated at **build time** and frozen into `.next/routes-manifest.json`, so every env var they read is a build-time input.
- **Headers are applied to rewritten paths too.** If the global CSP, `X-Frame-Options: DENY` and `frame-ancestors 'none'` were sent on `/__/auth/iframe`, the SDK could not embed its own iframe, and the handler page's scripts would be blocked. So the global header rule must exclude `/__/auth/` and `/__/firebase/`.
- The Firebase proxy pattern ("Best practices for using signInWithRedirect…", option 3) proxies `https://<app domain>/__/auth/` → `https://<project>.firebaseapp.com/__/auth/` transparently (not a 302). The nginx example is `location /__/auth { proxy_pass https://<project>.firebaseapp.com; }`. `authDomain` becomes the app domain. The OAuth redirect URI is `https://<app domain>/__/auth/handler`.
  - `firebase.google.com` was not reachable from the spec author's sandbox. This summary is from search results, so re-read the page (see Stop and ask).
  - We also proxy `/__/firebase/init.json`, because the hosted handler may fetch it. It is public config, so this is harmless.
- `src/components/ProfilePanel.tsx`:
  - :302-308 `onError` writes `innerHTML` with the username (SEC-15). The React fallback markup to reuse is at :312-314.
  - :959 and :1003 use `'/default-avatar.png'`, which does not exist in `public/`. T11a may have changed the admin-list data source; re-locate the sites by the `'/default-avatar.png'` literal.
- `public/manifest.json:25-32` references a missing `/screenshot-mobile.png`. `src/app/layout.tsx:45` references a missing `/favicon.ico`. `public/` holds only `icon-192x192.png`, `icon-512x512.png`, `manifest.json`, `patch-notes.md` and `placeholder-spot.jpg`.
- COOP must be `same-origin-allow-popups`, because plain `same-origin` breaks the Google popup (ROADMAP trap 4).

## Files
- Modify:
  - `next.config.mjs`
  - `src/components/ProfilePanel.tsx`
  - `src/components/SettingsPanel.tsx` (the two `useWebWorker` values only)
  - `public/manifest.json`
  - `src/app/layout.tsx` (the favicon link only)
- Create: `e2e/csp.spec.ts` (or the file layout T04 uses), and `scripts/check-headers.sh`.

## Steps
1. **`next.config.mjs`: CSP builder.** Add a top-level function:
   ```js
   const isDev = process.env.NODE_ENV !== 'production';
   const useEmulators = process.env.NEXT_PUBLIC_USE_EMULATORS === '1';
   function buildCsp() {
     const local = useEmulators ? ['http://127.0.0.1:*', 'http://localhost:*'] : [];
     const d = {
       'default-src': ["'self'"],
       'script-src': ["'self'", "'unsafe-inline'", ...(isDev ? ["'unsafe-eval'"] : []), 'https://apis.google.com', 'https://www.gstatic.com'],
       'style-src': ["'self'", "'unsafe-inline'"],
       'img-src': ["'self'", 'data:', 'blob:', 'https://*.tile.openstreetmap.org', 'https://*.basemaps.cartocdn.com', 'https://server.arcgisonline.com', 'https://firebasestorage.googleapis.com', 'https://*.googleusercontent.com', ...local],
       'font-src': ["'self'", 'data:'],
       'connect-src': ["'self'", 'https://*.googleapis.com', 'https://*.cloudfunctions.net', 'https://apis.google.com', ...local, ...(useEmulators ? ['ws://127.0.0.1:*', 'ws://localhost:*'] : [])],
       'frame-src': ["'self'", 'https://*.firebaseapp.com', 'https://apis.google.com', 'https://accounts.google.com', ...local],
       'worker-src': ["'self'", 'blob:'],
       'manifest-src': ["'self'"],
       'object-src': ["'none'"],
       'base-uri': ["'self'"],
       'form-action': ["'self'"],
       'frame-ancestors': ["'none'"],
     };
     const parts = Object.entries(d).map(([k, v]) => `${k} ${v.join(' ')}`);
     if (!isDev && !useEmulators) parts.push('upgrade-insecure-requests');
     return parts.join('; ');
   }
   ```
   The exact resulting strings are below. Assert them verbatim in `scripts/check-headers.sh`.
   - **Production** (`next build`, emulators off):
     `default-src 'self'; script-src 'self' 'unsafe-inline' https://apis.google.com https://www.gstatic.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.tile.openstreetmap.org https://*.basemaps.cartocdn.com https://server.arcgisonline.com https://firebasestorage.googleapis.com https://*.googleusercontent.com; font-src 'self' data:; connect-src 'self' https://*.googleapis.com https://*.cloudfunctions.net https://apis.google.com; frame-src 'self' https://*.firebaseapp.com https://apis.google.com https://accounts.google.com; worker-src 'self' blob:; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests`
   - **Dev** (`next dev`, emulators off): the same, but `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://www.gstatic.com`, and **without** `; upgrade-insecure-requests`.
   - **Emulator test build** (`NEXT_PUBLIC_USE_EMULATORS=1`): the production string without `upgrade-insecure-requests`, and with:
     - `http://127.0.0.1:* http://localhost:*` appended to `img-src`, `connect-src` and `frame-src`;
     - `ws://127.0.0.1:* ws://localhost:*` appended to `connect-src`.
   - `https://*.firebaseapp.com` stays in `frame-src`, so that the Vercel build (authDomain still `<project>.firebaseapp.com` during T19) keeps working.
2. **Headers.** `poweredByHeader: false`. `headers()` returns:
   - For `source: '/:path((?!__/auth/|__/firebase/).*)'`:
     - `Content-Security-Policy`: `buildCsp()`
     - `X-Content-Type-Options: nosniff`
     - `X-Frame-Options: DENY`
     - `X-XSS-Protection: 0`
     - `Referrer-Policy: strict-origin-when-cross-origin`
     - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
     - `Permissions-Policy: geolocation=(self), camera=(), microphone=(), payment=(), usb=()`
     - `Cross-Origin-Opener-Policy: same-origin-allow-popups`
   - For `source: '/__/:path*'`: only `Strict-Transport-Security`, `X-Content-Type-Options` and `Referrer-Policy`, with the same values. The upstream Firebase headers pass through.
   - Service worker: `route.ts` keeps its own `Content-Type`, `Service-Worker-Allowed: /` and `Cache-Control`. The global CSP is the worker's policy; do not add a separate one.
   - `camera=()` does not affect `<input type="file" accept="image/*">`, which uses the OS picker.
3. **Rewrites.**
   ```js
   async rewrites() {
     const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
     if (!projectId || useEmulators) return [];
     const upstream = `https://${projectId}.firebaseapp.com`;
     return [
       { source: '/__/auth/:path*', destination: `${upstream}/__/auth/:path*` },
       { source: '/__/firebase/init.json', destination: `${upstream}/__/firebase/init.json` },
     ];
   }
   ```
   Document in a comment above it:
   - In production, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` must equal the serving host (`spoton.isolapaul.hu`; see D6 and `docs/deploy.md`).
   - On Vercel it stays `<project>.firebaseapp.com` until Stage B.
   - `src/lib/firebase.ts` needs no change: it already reads `authDomain` from the env.
4. **`images`.** Leave `unoptimized` and `remotePatterns` unchanged.
5. **ProfilePanel avatar (SEC-15).**
   - Add `const [avatarFailed, setAvatarFailed] = useState(false);` with the other hooks, above any early `return`.
   - Add `useEffect(() => setAvatarFailed(false), [user?.profilePictureURL, user?.photoURL]);`.
   - Render the `<Image>` branch only when `(user.profilePictureURL || user.photoURL) && !avatarFailed`, with `onError={() => setAvatarFailed(true)}`.
   - Otherwise render the **existing** else-branch markup (:312-314) unchanged.
   - Remove the `innerHTML` code completely.
6. **ProfilePanel `/default-avatar.png` (BUG-08).** At both sites, if `photoURL` is truthy, keep the `<Image>`. Otherwise render an initial-letter circle of the same outer size and border as the existing wrapper:
   - `<div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-purple-500/30 bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center"><span className="text-white text-xl font-bold">{(searchedUser.username?.charAt(0) || 'U').toUpperCase()}</span></div>`
   - For the admin row: `w-12 h-12`, `border-amber-500/30`, `text-lg`, and `admin.name`.
   - Use the field names the current code has after T11a. Do not add a binary asset.
7. **SettingsPanel.** Change `useWebWorker: true` → `false` at both call sites. Same output; no CDN worker script.
8. **Assets.**
   - Delete the `"screenshots"` array from `public/manifest.json` and keep it valid JSON.
   - In `layout.tsx`, replace `<link rel="icon" href="/favicon.ico" />` with `<link rel="icon" href="/icon-192x192.png" type="image/png" />`.
9. **`scripts/check-headers.sh BASE`.**
   - Uses `curl -sI` against `$BASE/` and `$BASE/api/firebase-messaging-sw`, and asserts every header in step 2, with the exact CSP string as `$EXPECTED_CSP`.
   - Checks that there is no `x-powered-by`.
   - Checks that `$BASE/__/auth/handler` carries **no** `content-security-policy` and **no** `x-frame-options`.
   - Checks `routes-manifest.json` for the two rewrites.
10. **`e2e/csp.spec.ts`.**
    - Attach a violation collector before navigation: `page.on('console', m => /Content Security Policy|Refused to/.test(m.text()) && v.push(m.text()))`, plus `page.addInitScript(() => document.addEventListener('securitypolicyviolation', e => console.error('CSP violation', e.violatedDirective, e.blockedURI)))`.
    - Run T04's smoke flow: load; pass the language selector and install gate using T04's helpers; wait for map tiles; open a seeded spot; sign in with the emulator user; open the profile panel, and in it the settings (profile image upload with a small PNG fixture if T04 has one); open the feedback panel.
    - Assert `v` is empty.

## Must NOT change
- All UI output, apart from the avatar fallback, which is visually identical to today's fallback.
- Every current feature: sign-in (popup and redirect), map tiles in all 5 themes, spot images, Google avatars, uploads, callables, push registration and SW background messages.
- `src/lib/firebase.ts` configuration logic.
- `images.unoptimized` / `remotePatterns`.
- `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy` and the HSTS values.

## Acceptance
```bash
npm run verify
grep -rn "innerHTML\|default-avatar.png\|screenshot-mobile\|favicon.ico" src public && exit 1 || true
grep -n "useWebWorker: true" src -r && exit 1 || true

# Production build (demo public config), header assertions
export NEXT_PUBLIC_FIREBASE_API_KEY=demo-key NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=localhost \
  NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-spoton NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=demo-spoton.appspot.com \
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=0 NEXT_PUBLIC_FIREBASE_APP_ID=1:0:web:0 NEXT_PUBLIC_FIREBASE_VAPID_KEY=demo
npm run build && (npx next start -p 3000 & echo $! > /tmp/next.pid)
for i in $(seq 60); do curl -s -o /dev/null http://127.0.0.1:3000/ && break; sleep 1; done
bash scripts/check-headers.sh http://127.0.0.1:3000
curl -sI http://127.0.0.1:3000/ | grep -i "content-security-policy" | grep -q "unsafe-eval" && exit 1 || true
grep -q '"/__/auth/:path\*"' .next/routes-manifest.json
node -e "JSON.parse(require('fs').readFileSync('public/manifest.json','utf8'))"
kill $(cat /tmp/next.pid)

# Emulator build: zero CSP violations on the smoke flow
npm run test:e2e        # includes e2e/csp.spec.ts
```
The `/__/auth/handler` upstream (`*.firebaseapp.com`) is not reachable from the sandbox. The check there is only that our security headers are absent on that path. The 200-from-upstream check is in the T17 post-deploy checklist.

**Manual checklist.** Google OAuth cannot run headless. Paul does this on the first deploy, after the `docs/deploy.md` console steps:
- [ ] Desktop Chrome: Google popup sign-in succeeds; DevTools console shows no CSP errors.
- [ ] iOS Safari (not installed): sign-in via redirect succeeds and returns to the app signed in.
- [ ] iOS home-screen PWA: sign-in succeeds.
- [ ] `https://spoton.isolapaul.hu/__/auth/handler` returns 200 with Firebase HTML (`curl -s … | grep -i firebase`).
- [ ] All 5 map themes load tiles; the avatar and spot images show; push permission and token registration succeed.

## Rollback
`git revert`. If sign-in breaks after the deploy, first set the Vercel/GitHub variable `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` back to `<project>.firebaseapp.com`, then rebuild. The proxy is harmless when unused.

## Stop and ask Paul if…
- The re-read Firebase "redirect best practices" page (option 3) lists proxied paths other than `/__/auth/` and `/__/firebase/init.json`, or says the proxy needs special headers.
- Paul's current `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` is **not** `<projectId>.firebaseapp.com`, for example a custom hosting site. The rewrite upstream would then be wrong.
- The e2e flow shows a violation for a host not listed here. Add it only with evidence of which feature needs it, never as a wildcard like `https:`.
- A Cloudflare feature that injects scripts (Rocket Loader, Email Obfuscation, Web Analytics auto-inject) is enabled on the zone. It must be disabled, not allowed in the CSP.
