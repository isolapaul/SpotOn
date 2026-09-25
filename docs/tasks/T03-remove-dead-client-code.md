# T03 — Remove dead client code

**Phase:** 0 · **Depends on:** T01 · **Risk:** low · **Decisions:** —
**Audit refs:** code-review §3 (dead code and leftovers), ARCH-05, DUP-17

## Goal
Delete client code that is never imported, never reachable, or written but never read, so later refactors work on less surface. This is purely subtractive: the UI, the data and the network behaviour stay identical.

## Context
All line numbers are at commit `eee5668`, and every item below was verified unused. Before deleting anything, run the **Proof** block. Its output must match the comments exactly.

| # | Item |
|---|---|
| 1 | `src/hooks/useQuestProgress.ts` (Valentine quest hook) |
| 2 | `src/hooks/useMobile.ts` |
| 3 | `src/components/Toast.tsx` |
| 4 | `src/types/index.ts` (drifting duplicate types, ARCH-05) |
| 5 | `src/components/FilterPanel.tsx`, `src/components/DistanceSelector.tsx`: mounted in `page.tsx`, but nothing ever opens them. Also their state, handlers and JSX in `page.tsx`. |
| 6 | ~~`src/store/useUiStore.ts`~~ **KEEP, do not touch.** Its field `notificationPromptVisible` is unused today, but T19 and T29 build on this store (T29 removes the unused field). Orchestrator decision. |
| 7 | `useToastStore.toasts` and `removeToast` (no-ops, never used) |
| 8 | the `messaging` export and eager `getMessaging` in `src/lib/firebase.ts:57-67`. `usePushNotifications.ts:53` calls `getMessaging(app)` itself. The eager instance registered no `onMessage` handler, so removing it changes nothing observable. |
| 9 | `globalForegroundUnsubscribe` in `src/hooks/usePushNotifications.ts` (written at :171, never read) |
| 10 | `CUSTOM_SPOT_ICONS` in `src/lib/levelUtils.ts:186-195` |
| 11 | the unused `translations` import in `src/components/LanguageSelector.tsx:6` |
| 12 | the Google Maps CSS in `src/app/globals.css:192-240` (the app uses Leaflet). Lines 192–241 are top-level rules; line 241 is blank. |
| 13 | the quest translation keys, 7 per language: `questInProgress questDone claimRewards claimingRewards claimError daysRemaining questEnded` (`translations.ts` hu 180-186, en 501-507, de 804-810) |
| 14 | the translation keys used **only** by the deleted FilterPanel, DistanceSelector or `handleDistanceSelect`, 10 per language: `filters distance anyDistance within1km within5km within10km within25km within50km clearFilters noSpotsInRange` (hu 115-122, 124, 267; en 436-443, 445, 588; de 757, 812-818, 820, 901). **Keep `allCategories`**: DiscoveryPanel uses it. |

Proof block, run from the repo root. A `grep` that finds nothing exits 1; that is expected.
```bash
grep -rn "useQuestProgress" src | grep -v "^src/hooks/useQuestProgress.ts"          # 1: nothing
grep -rn "useMobile" src | grep -v "^src/hooks/useMobile.ts"                        # 2: nothing
grep -rnE "components/Toast['\"]|from '\./Toast'" src                             # 3: nothing
grep -rnE "@/types|/types['\"]" src                                                # 4: nothing
grep -rnE "setFilterPanelOpen\(true\)|setDistanceSelectorOpen\(true\)" src          # 5: nothing
grep -rnE "FilterPanel|DistanceSelector" src --include=*.tsx \
  | grep -v "^src/components/FilterPanel.tsx\|^src/components/DistanceSelector.tsx" \
  | cut -d: -f1,2                                  # 5: only src/app/page.tsx:11 12 52 53 291 293 302 304
grep -rnE "removeToast|\.toasts\b|\{[^}]*\btoasts\b" src \
  | grep -v "^src/store/useToastStore.ts\|^src/components/Toast.tsx"                # 7: nothing
grep -rnE "import[^;]*\bmessaging\b[^;]*from '@/lib/firebase'" src                  # 8: nothing
grep -n "globalForegroundUnsubscribe" src/hooks/usePushNotifications.ts | cut -d: -f1   # 9: 15 and 171 only
grep -rn "CUSTOM_SPOT_ICONS" src functions/src | grep -v "^src/lib/levelUtils.ts"   # 10: nothing
grep -n "translations" src/components/LanguageSelector.tsx | cut -d: -f1            # 11: 6 only
grep -rnE "gm-style|gmnoprint|gm-ui-hover|alt=\"Google\"|Keyboard shortcuts|maps\.google\.com" \
  src public --include=*.ts --include=*.tsx --include=*.json                        # 12: nothing
```
For item 12: `getNavigationUrl` builds `https://www.google.com/maps/dir/…`, which does not match `a[href^="https://maps.google.com/maps"]`. Leaflet renders none of these selectors.

Key loop. Before the deletions, it prints only FilterPanel, DistanceSelector and `page.tsx:245` hits for group 14, and nothing for group 13. After the deletions it must print nothing:
```bash
for k in questInProgress questDone claimRewards claimingRewards claimError daysRemaining questEnded \
         filters distance anyDistance within1km within5km within10km within25km within50km clearFilters noSpotsInRange; do
  grep -rnE "['\"\`]$k['\"\`]|\.$k\b" src --include=*.ts --include=*.tsx | grep -v "^src/lib/translations.ts"
done
```
`TranslationKey` is `keyof typeof translations.hu`, so `tsc` also catches any remaining `t('<removed>')`.

**What stays in `page.tsx`:** `userLocation`, because `DiscoveryPanel` and the geolocation effect use it; `t` and `useMemo`. `calculateDistance` becomes unused and is removed (T23 re-creates Haversine in `lib/geo.ts` from `DiscoveryPanel`). With FilterPanel gone, `selectedDistance` and `selectedCategory` can never be non-null. The old `visibleSpots` was always `userIsAdmin ? spots : spots.filter(s => s.status === 'approved')`, and it stays exactly that.

**Out of scope (do not touch):**
- the second composite index in `firestore.indexes.json` (the functions and rules phases decide);
- the quest code in `functions/`;
- "PHASE n" comments;
- `CHANGELOG.md` and `README.md` (T20).

## Files
- Delete: `src/hooks/useQuestProgress.ts`, `src/hooks/useMobile.ts`, `src/components/Toast.tsx`, `src/types/index.ts` (and the then-empty `src/types/`), `src/components/FilterPanel.tsx`, `src/components/DistanceSelector.tsx`
- Modify: `src/app/page.tsx`, `src/store/useToastStore.ts`, `src/hooks/usePushNotifications.ts`, `src/lib/firebase.ts`, `src/lib/levelUtils.ts`, `src/components/LanguageSelector.tsx`, `src/app/globals.css`, `src/lib/translations.ts`

## Steps
1. Run every Proof command and the key loop. Stop if any output differs from the table.
2. `git rm` the 7 files in **Files → Delete**.
3. `src/app/page.tsx`:
   - Remove the imports on lines 11 (`FilterPanel`), 12 (`DistanceSelector`) and 22 (`useToastStore`).
   - Remove the state on lines 49 (`selectedDistance`), 50 (`selectedCategory`), 52 (`filterPanelOpen`) and 53 (`distanceSelectorOpen`), and line 60 (`const { showToast } = useToastStore();`).
   - Replace lines 67–105 (`calculateDistance` and the old `visibleSpots`) with:
     ```tsx
       // Filter spots based on user role: admins see all spots, everyone else only approved ones
       const visibleSpots = useMemo(
         () => (userIsAdmin ? spots : spots.filter(spot => spot.status === 'approved')),
         [spots, userIsAdmin],
       );
     ```
   - Remove `handleClearFilters` (221–224) and `handleDistanceSelect` (230–256), including their trailing blank lines.
   - Remove the JSX blocks `{/* Filter Panel */}…<FilterPanel …/>` and `{/* Distance Selector Modal */}…<DistanceSelector …/>` (290–306). Keep `{/* Discovery Panel */}` and everything else.
4. `src/components/NotificationPrompt.tsx` and `src/store/useUiStore.ts`: **no change** (see item 6).
5. `src/store/useToastStore.ts`: remove the `toasts` and `removeToast` members from the `ToastStore` interface (lines 14, 16) and from the store object (line 20 with the blank line after it, and lines 35–38). `showToast` and the exported `ToastType` stay unchanged.
6. `src/hooks/usePushNotifications.ts`:
   - Delete line 15 (`let globalForegroundUnsubscribe …`). Keep the comment above it and `listenerSetup`.
   - Change line 150 `const unsubscribe = onMessage(messaging, (payload) => {` to `onMessage(messaging, (payload) => {`.
   - Delete lines 169–171 (the blank line, `// Store unsubscribe function globally`, and `globalForegroundUnsubscribe = unsubscribe;`).
7. `src/lib/firebase.ts`:
   - Delete the `firebase/messaging` import (line 5) and the block at lines 57–65 (`// Initialize Firebase Messaging …` through the closing `}`, plus the blank line after it).
   - Change the export to `export { app, auth, db, storage, functions, googleProvider };`.
8. `src/lib/levelUtils.ts`: delete lines 186–195 (the JSDoc "Get available custom icons…", `CUSTOM_SPOT_ICONS`, and the following blank line).
9. `src/components/LanguageSelector.tsx`: delete line 6 (`import { translations } from '@/lib/translations';`).
10. `src/app/globals.css`: delete lines 192–241 (from `/* Remove white background from Google Maps InfoWindow */` through the blank line before `/* iOS safe area support */`).
11. `src/lib/translations.ts`: in **each** of `hu`, `en` and `de`, delete the 17 key lines listed in items 13 and 14 (51 lines in total). Delete only the key lines; keep neighbouring keys, comments and blank lines. `allCategories` stays.
12. Run the key loop and the Acceptance.

## Must NOT change
- Rendered UI in every language, including the empty-state text, the discovery panel, notification prompt behaviour (3 s delay, session dismissal) and toasts, which forward to the NotificationCenter.
- `visibleSpots` semantics: admins get the `spots` array itself; everyone else gets the approved-only filter.
- `src/lib/firebase.ts` init, persistence and `functions` region. `app`, `auth`, `db`, `storage`, `functions` and `googleProvider` are exported unchanged.
- Push behaviour: the single foreground listener (`listenerSetup` guard), token registration, and the SW route.
- All other translation keys and values; `firestore.indexes.json`; `functions/`.

## Acceptance
```bash
# (export the demo NEXT_PUBLIC_FIREBASE_* values from T01 if no .env.local)
npm run verify                                     # 0 errors
test ! -e src/types && test -e src/store/useUiStore.ts && echo "deleted ok, useUiStore kept"
# key loop from Context: prints nothing
for k in questInProgress questDone claimRewards claimingRewards claimError daysRemaining questEnded filters distance anyDistance within1km within5km within10km within25km within50km clearFilters noSpotsInRange; do grep -rnE "['\"\`]$k['\"\`]|\.$k\b" src --include=*.ts --include=*.tsx | grep -v "^src/lib/translations.ts"; grep -cE "^    $k: " src/lib/translations.ts | grep -v '^0$'; done   # prints nothing
grep -rnE "FilterPanel|DistanceSelector|useQuestProgress|useMobile|CUSTOM_SPOT_ICONS|globalForegroundUnsubscribe|removeToast|gm-style" src   # nothing
grep -c "allCategories" src/lib/translations.ts    # 3
npm run lint 2>&1 | grep -c "LanguageSelector"     # 0 (the unused-import warning is gone)
npm run test:e2e                                   # if T04 has landed: all green
```
Manual check (`npm run dev`, all 3 languages): the map loads, markers show, the discovery panel opens and filters, spot details open, sign-in works, and the notification prompt appears for a signed-in user with default permission.

## Rollback
`git revert` the commit. No data or deploy impact.

## Stop and ask Paul if…
- Any Proof command prints something not described in the table.
- `tsc` reports a removed translation key still in use.
