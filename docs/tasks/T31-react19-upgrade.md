# T31 — React 19, react-leaflet 5, zustand 5

**Phase:** 6 · **Depends on:** T29 · **Risk:** med · **Decisions:** D7
**Audit refs:** — (stack currency; prerequisite for T32)

## Goal
- Upgrade the client to React 19 with matching types, react-leaflet 5 and zustand 5.
- Fix every breaking-change site.
- Keep the app's behaviour identical. `npm run verify` and the e2e suite stay green.

## Context
- **Today** (`package.json` at `eee5668`; T05/T06 bumped next and firebase since, so re-read it): `react`/`react-dom` `^18.3.1`, `@types/react` `^18.3.1`, `@types/react-dom` `^18.3.0`, `react-leaflet` `^4.2.1`, `zustand` `^4.5.7`, `lucide-react` `^0.378.0`, `@types/leaflet` `^1.9.21`, `leaflet` `^1.9.4`.
- **Registry**, checked on 2026-09-25 with `npm view`. **Re-check before pinning**:

  | Package | Version | Peer / notes |
  |---|---|---|
  | `react`, `react-dom`, `@types/react`, `@types/react-dom` | `19.3.0` | — |
  | `react-leaflet` | `5.0.0` | peers `react ^19`, `react-dom ^19`, `leaflet ^1.9.0`; depends on `@react-leaflet/core ^3.0.0` |
  | `zustand` | `5.0.15` | peers `react >=18`, optional `use-sync-external-store`, `immer` |
  | `next` | `16.3.6` | peers `react ^18.2 \|\| ^19` |
  | `lucide-react` | `0.378.0` | peer is `react ^16 \|\| ^17 \|\| ^18` → **`npm ci` fails with ERESOLVE under React 19** |
  | `lucide-react` | `0.469.0` | first 0.x with a `^19.0.0` peer |
  | `lucide-react` | `0.577.0` | latest 0.x |
  | `lucide-react` | `1.x` | a major with possible icon renames. **Do not jump to 1.x in this task.** |
- **Next App Router uses its own vendored React** (`next/dist/compiled/react`) for `src/app`. The app therefore very likely already *runs* on React 19 in the browser, and this task aligns the installed packages, types and third-party peers (react-leaflet, lucide). Verify once:
  - in `next dev`, run `require('react').version` in the browser console via React DevTools, or check `grep -rn "\"version\"" node_modules/next/dist/compiled/react/package.json`;
  - record the result in the commit body.
- **Zustand stores:** `useSpotStore`, `useUserStore` (persist), `useLanguageStore` (persist), `useMapThemeStore` (persist), `useNotificationStore` (persist), `useToastStore`, `useUiStore`, and the new T29/T30 stores.
  - All use `import { create } from 'zustand'`, which v5 keeps; the default export is gone.
  - `persist` stores already use the curried `create<T>()(persist(...))` form.
- **Zustand 5 risk.** v5 uses React's native `useSyncExternalStore`. A selector that returns a **new object or array on every call** makes React warn `getSnapshot should be cached` and can loop forever. v4 tolerated this.
  - `useXStore()` with no selector returns the state object, whose identity changes only on `set`, so it is safe. It re-renders on any change, as in v4.
  - Destructuring `const { a, b } = useXStore()` is therefore safe.
  - Risky patterns: `useXStore(s => ({ … }))`, `useXStore(s => [ … ])`, `useXStore(s => s.list.filter/map(...))`, `useXStore(s => s.getX())` when that returns a fresh array.
  - At `eee5668` the only selector is `useUserStore((s) => s.user)` in FeedbackPanel, which is safe. T24–T30 added hooks (`useT`, `useIsAdmin`, `useFavoriteToggle`, `useVisibleSpots`, the SpotDetails `find` by id, and so on) that must be re-audited.
  - The equality-function second argument (`useStore(sel, shallow)`) is removed in v5. Use `useShallow` from `zustand/react/shallow`, or `createWithEqualityFn` from `zustand/traditional`.
  - `persist` v5 no longer writes the initial state to storage at store creation. `useUserStore`'s `onRehydrateStorage` mutates `state.loading = true`; this must still hold after hydration.
- **React 19 type and API changes relevant here:**
  - `useRef<T>()` with no argument is a type error; pass `null` or `undefined`.
  - The global `JSX` namespace is removed; use `React.JSX`.
  - `ReactElement['props']` defaults to `unknown`.
  - Ref callbacks must not implicitly return a value.
  - `forwardRef` still works, but `ref` can now be a prop. Only convert components that T25 created with `forwardRef` if trivial; otherwise leave them.
  - `defaultProps` on function components is removed (none are expected; grep).
  - `element.ref` access is deprecated.
- **react-leaflet 5:**
  - The API used here is unchanged: `MapContainer`, `TileLayer`, `Marker`, `useMap`, `useMapEvents`, and the `eventHandlers` prop.
  - Keep `reactStrictMode: true`, and verify that no "Map container is already initialized" error appears in dev.
  - `next/dynamic(() => import('@/components/MapView'), { ssr: false })` in the client page stays valid.

## Files
- Modify: `package.json`, `package-lock.json`, and every `src/**` file flagged by the audits below.
- Create: `src/store/zustand-selectors.test.ts` (a render-loop guard, see step 5), if RTL is available.

## Steps
1. **Re-verify versions:**
   ```bash
   npm view react version; npm view react-dom version; npm view @types/react version; npm view @types/react-dom version
   npm view react-leaflet version; npm view react-leaflet peerDependencies; npm view zustand version
   npm view lucide-react@0.577.0 peerDependencies; npm view @testing-library/react version   # if T01 uses RTL (needs ≥16 for React 19)
   ```
   Pin **exact** versions, with no `^` for react, react-dom, react-leaflet or zustand (CLAUDE rule 10): `react@19.3.0 react-dom@19.3.0 @types/react@19.3.0 @types/react-dom@19.3.0 react-leaflet@5.0.0 zustand@5.0.15 lucide-react@0.577.0`. Keep `leaflet` and `@types/leaflet` on 1.9.x.
2. **Install** with `npm install <pins>`. The result must have no `--legacy-peer-deps` and no `overrides`. Then run `npm ls react react-dom` and check that there is a single version, with no `invalid` or `UNMET PEER`.
3. **Types:** run `npx tsc --noEmit` and fix each error at the source. Do not use `any` or `@ts-expect-error` unless it is justified in the commit body. Checks:
   - `grep -rn "useRef<[^>]*>()" src`: none may remain.
   - `grep -rn "JSX\.Element\|: JSX\." src`: replace with `React.JSX.Element`, or remove the annotation.
   - `grep -rn "defaultProps\|propTypes\|forwardRef" src`: inspect each hit.
4. **lucide-react 0.577.0:** every imported icon name must still exist (tsc catches this). The icons in use are X, Heart, Star, MapPin, Share2, Calendar, User, Send, CheckCircle, Shield, ImagePlus, Sparkles, Pencil, Trash2, Image, Settings, Clock, UserPlus, Plus, TrendingUp, LogIn, Mail, Lock, Share, MoreVertical, Smartphone, Monitor, Globe, Check, Camera, LogOut, Bell, BellOff, MessageSquare, Palette, Filter, Upload, Loader2 and AlertCircle. Deprecated aliases such as `CheckCircle` and `AlertCircle` still exist in 0.x. Keep the names unless tsc fails.
5. **Zustand audit:**
   ```bash
   grep -rnE "use[A-Z][A-Za-z]*Store\(\s*\(?[a-z]+\)?\s*=>" src          # every selector call
   grep -rnE "use[A-Z][A-Za-z]*Store\([^)]*,\s*[a-zA-Z]" src             # equality-fn 2nd arg (v4 only)
   grep -rn "from 'zustand'" src; grep -rn "zustand/shallow\|zustand/traditional" src
   ```
   For each selector, classify it in the commit body as primitive / stable reference / **new object** (wrap in `useShallow`, or split into several primitive selectors) / **derived array** (move into `useMemo` on a stable selected slice).
   - Example: `useSpotStore(s => s.spots.find(x => x.id === id))` returns an existing element reference, so it is safe.
   - Example: `useSpotStore(s => s.spots.filter(...))` is unsafe; select `s.spots`, then `useMemo`.

   If RTL + jsdom exist, add a test that renders each custom hook built on a store selector (`useIsAdmin`, `useFavoriteToggle`, `useVisibleSpots`, `useT`, …) and asserts ≤ 2 renders after mount, with no console error containing `getSnapshot`.
6. **Persist:** open the app with an existing `spoton-user` localStorage entry. `loading` must be `true` until `initAuth` resolves, with no flash of the signed-in UI for a signed-out session. Cover this in e2e if T04 has a signed-in storage state, otherwise check manually. Check that the persist keys `spoton-user`, `spoton-language`, `spoton-map-theme` and `spoton-notifications` still hydrate (language, theme and notifications survive a reload).
7. **Runtime check** in `npm run dev` (StrictMode):
   - no console errors or warnings about `getSnapshot`, `act`, leaflet re-initialisation or keys;
   - markers, tile switching, info window, panels and swipe all work.
8. Run `npm run verify` and `npm run test:e2e`.

## Must NOT change
- All UI and behaviour; persisted storage keys and shapes (users must not lose language, theme or notifications).
- Map behaviour: centre, zoom, pan-once, marker icons, click handling, theme tiles.
- No new runtime dependencies besides the version bumps (`use-sync-external-store` is **not** needed unless `zustand/traditional` is used; avoid it).

## Acceptance
```bash
npm ci                              # clean install, no peer errors
npm ls react react-dom react-leaflet zustand lucide-react   # single versions, no invalid
npm run verify
npm run test:e2e
grep -n '"react": "19\|"react-dom": "19\|"react-leaflet": "5\|"zustand": "5' package.json   # all four, exact pins
```
Plus the classification table in the commit body (step 5), and zero `getSnapshot` warnings in the e2e console logs. Add an e2e fixture assertion that collects `page.on('console')` errors and fails on `getSnapshot|Maximum update depth`.

## Rollback
`git revert` the commit, then `npm ci`. Persisted state is compatible both ways, since the keys and shapes are unchanged.

## Stop and ask Paul if…
- Any peer dependency conflict needs `--legacy-peer-deps` or `overrides`.
- lucide-react 0.x cannot be used and a jump to 1.x (with icon renames) is required.
- react-leaflet 5 changes behaviour visibly (marker events, tile swapping, attribution) in a way that cannot be restored locally.
