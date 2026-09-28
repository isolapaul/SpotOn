# T27 — Split ProfilePanel

**Phase:** 5 · **Depends on:** T26 · **Risk:** med · **Decisions:** D8
**Audit refs:** ARCH-02, ARCH-01, code smells (`getLevelInfo` recomputed 7×, IIFEs in JSX, async `onClick` bodies)

## Goal
Break the ~1270-line `ProfilePanel.tsx` into focused components under `src/components/profile/`, each at most 300 lines, each owning only its own state. The UI and behaviour stay identical, apart from the accepted state resets listed after the Steps.

## Context
Line ranges below are from `eee5668`. After T11a, T15, T22–T26 the file has changed: admin search is a callable, the `innerHTML` fallback is replaced, strings are keys, PanelShell/StarRating/useSwipeToClose are used, and `useUserSpots` exists. **Map each block by its landmark comment or JSX, not by number.**

| Landmark (current lines) | Content | Target file |
|---|---|---|
| props, top-level hooks, `activeTab`, `isSettingsOpen`, `showLevelInfo`, swipe (:16-51, :196-229) | orchestration | `profile/ProfilePanel.tsx` |
| `getStatusClassName`, `getStatusText` (:53-65) | pure status → class/key | `src/lib/spotStatus.ts` (`STATUS_CLASS`, `STATUS_LABEL_KEY` static maps) |
| own-spots listener (:67-83) | already `useUserSpots` (T26) | used in `ProfilePanel.tsx` |
| categories listener (:85-100), `handleAddCategory` (:177-194) | category CRUD | `src/hooks/useCategories.ts` (`{ categories, addCategory, isAdding }`), called as `useCategories(isOpen && isSuperAdmin)` in `profile/ProfilePanel.tsx`; `categories`/`addCategory`/`isAdding` are passed down `AdminTab` → `profile/admin/CategoryManager.tsx` (owns only its inputs) |
| `handleApproveSpot` (:107-113) | approve | `profile/tabs/PendingTab.tsx` |
| `handleSearchUser`, `handleAddAdmin` (:115-149) + state `adminEmailInput`, `searchedUser`, `isSearching` | admin search/grant | `profile/admin/AdminSearch.tsx` |
| `handleRemoveAdmin` (:151-160) | revoke | `profile/admin/AdminList.tsx` |
| `handleSaveUsername` (:162-175) + state `isEditingUsername`, `newUsername`, `isSavingUsername`; JSX `{isEditingUsername ? …}` (:321-361) | username edit | `profile/UsernameEditor.tsx` |
| `{/* Profile Banner */}` + top buttons (:254-286) | banner, settings, close | `profile/ProfileBanner.tsx` (props `bannerUrl`, `onOpenSettings`, `onClose`) |
| `{/* Large Profile Picture */}` (:291-316) | avatar + fallback (T15 state) | `profile/ProfileAvatar.tsx` |
| `{/* Badges Row */}` (:364-385) | admin shield + level pill | `profile/ProfileBadges.tsx` |
| `{/* Level Progress Button */}` (:387-430) | progress card + perks | `profile/LevelProgressCard.tsx` |
| stats row (:432-441) | spots / favourites counts | `profile/ProfileStats.tsx` |
| wrapper of the four blocks above (:288-444) | header column | `profile/ProfileHeader.tsx` (composes Avatar, UsernameEditor, Badges, LevelProgressCard, Stats) |
| `{/* Tabs */}` (:446-507) | tab bar | `profile/ProfileTabs.tsx` (props `active`, `onChange`, `isAdmin`, `isSuperAdmin`, `pendingCount`) |
| `activeTab === 'my-spots'` (:511-803) | my spots tab | `profile/tabs/MySpotsTab.tsx` (owns `showHighlightPanel`, `showCustomizationPanel`) |
| `{/* Level Management Buttons */}` (:513-540) | perk toggles | inside `MySpotsTab.tsx` |
| `{/* Highlight Panel */}` (:542-635) + state `isHighlighting` | highlight manager | `profile/HighlightManager.tsx`; the async `onClick` body (:602-617) becomes a named `handleToggleHighlight(spot)` |
| `{/* Level 5 Customization Panel */}` (:637-766) + state `isCustomizing` | name customizer | `profile/NameCustomizer.tsx`, with named handlers for the colour and font `onClick` bodies (:661-671, :703-713) |
| `{/* My Spots List */}` (:768-801) | list | `profile/MySpotList.tsx` + `profile/ProfileSpotCard.tsx` (thumb via `getThumbnailUrl`/`isImageUnoptimized`, T23) |
| `activeTab === 'favorites'` (:805-863) | favourites | `profile/tabs/FavoritesTab.tsx` (reuses `ProfileSpotCard` with a rating slot; StarRating `xs`/`faint`) |
| `activeTab === 'pending' && userIsAdmin` (:865-917) | pending list + approve | `profile/tabs/PendingTab.tsx` |
| `activeTab === 'admin' && userIsSuperAdmin` (:919-1089) | admin tab | `profile/tabs/AdminTab.tsx` (composes AdminSearch :922-985, AdminList :987-1031, CategoryManager :1033-1087) |
| `<SettingsPanel …/>` (:1094) | unchanged component | rendered by `ProfilePanel.tsx` |
| `{/* Level Info Modal */}` (:1096-1269) | level system modal | `profile/LevelInfoModal.tsx` (props `levelInfo`, `spotsCount`, `onClose`; the current level comes from the `levelInfo` prop, not a new `getLevelInfo` call); the per-level perk lists (:1195-1251) become a static `LEVEL_PERKS: Record<1..5, Array<{ emoji: string \| null; keys: TranslationKey[]; variant?: 'muted' }>>` in the same file. Level 1 is `[{ emoji: null, keys: ['noSpecialBenefits'], variant: 'muted' }]` (today's `<li className="text-white/50 italic">` with no emoji span, :1195-1197); multi-key entries render their keys joined by a space (`highlightOneSpot goldAppearance`) |

**Resulting tree:**
```
src/components/profile/
  ProfilePanel.tsx          (default export; the old path re-exports it)
  ProfileBanner.tsx  ProfileHeader.tsx  ProfileAvatar.tsx  UsernameEditor.tsx
  ProfileBadges.tsx  LevelProgressCard.tsx  ProfileStats.tsx  ProfileTabs.tsx
  MySpotList.tsx  ProfileSpotCard.tsx  HighlightManager.tsx  NameCustomizer.tsx
  LevelInfoModal.tsx
  tabs/MySpotsTab.tsx  tabs/FavoritesTab.tsx  tabs/PendingTab.tsx  tabs/AdminTab.tsx
  admin/AdminSearch.tsx  admin/AdminList.tsx  admin/CategoryManager.tsx
```
`src/components/ProfilePanel.tsx` becomes `export { default } from './profile/ProfilePanel';`, so `page.tsx` and the e2e tests are untouched. Alternatively update the single import in `page.tsx`.

**State ownership:**
- `ProfilePanel`:
  - owns `activeTab`, `isSettingsOpen` and `showLevelInfo`;
  - calls `useUserSpots(user.uid, isOpen)` → `mySpots`, `useIsAdmin()`, `useIsSuperAdmin()`, `useSwipeToClose`, and `useCategories(isOpen && isSuperAdmin)` (so the categories listener lifetime is unchanged: it does not depend on the admin tab being mounted);
  - computes `levelInfo = getLevelInfo(spotsCount)` **once**, where `spotsCount` is whatever T11a/T26 established (today `mySpots.length`), and passes it down;
  - derives `favoriteSpots` and `pendingSpots` from the spot store as today (:104-105).
- `UsernameEditor`: its 3 states.
- `MySpotsTab`: the two panel toggles.
- `HighlightManager`: `isHighlighting`.
- `NameCustomizer`: `isCustomizing`.
- `AdminSearch`: input, result and searching state.
- `CategoryManager`: only its name and icon inputs; `categories`, `addCategory` and `isAdding` come in as props.
- Everything else is stateless (props in, callbacks out).

## Files
- Create: every file in the tree above, plus `src/hooks/useCategories.ts` and `src/lib/spotStatus.ts` (+ `spotStatus.test.ts`).
- Modify: `src/components/ProfilePanel.tsx` (becomes a re-export).
- Delete: none.

## Steps
1. Create `src/lib/spotStatus.ts` with static maps, and test that they equal the old helper outputs for `approved`, `pending`, `rejected` and `'x'`.
2. Create `useCategories(enabled)` by moving the `categories` `onSnapshot` and `addDoc` unchanged. `ProfilePanel.tsx` calls it with `isOpen && isSuperAdmin` (today's gating), and the same toast keys stay at the call site.
3. Extract the leaf components first (Banner, Avatar, Badges, LevelProgressCard, Stats, ProfileSpotCard, StatusBadge usage), then the containers (HighlightManager, NameCustomizer, MySpotList, tabs, admin), then LevelInfoModal. **Commit after each group**, running `npm run verify` and `npm run test:e2e` each time.
4. Replace every `(() => { const levelInfo = getLevelInfo(...); … })()` IIFE with the prop `levelInfo`. `getLevelInfo` must be called only in `ProfilePanel.tsx` (once, the current level) and `LevelInfoModal.tsx` (once, the per-level table). `LevelInfoModal` gets the current level via its `levelInfo` prop; `isUnlocked` becomes `level <= levelInfo.level`.
5. `ProfilePanel.tsx` keeps the early return `if (!isOpen || !user) return null` **after** all hooks, as today.
6. Check the line limit: `wc -l src/components/profile/**/*.tsx`. Every file must be ≤ 300 lines; target ≤ 200.
7. **DOM equality check:** reuse T25's `__dom__` snapshot helper (T25 step 7; recreate it if T25 deleted it). Capture the open profile panel before the split for each tab (my-spots, favourites, pending and admin as super-admin) and with the level-info modal open, and compare after the split with normalised class lists.

**Intended behaviour changes (accepted):** child components now own their state and unmount when hidden, so these reset where today they persisted:
- `showHighlightPanel` and `showCustomizationPanel` reset on tab switch and on panel close.
- The admin search input and search result reset on tab switch.
- Username edit mode (and its draft) resets on panel close.

## Must NOT change
- Rendered DOM, classes, texts, aria-labels, ids (`edit-username`, `admin-email`) and tab order/visibility.
- Which listeners run and when:
  - own spots only while the panel is open;
  - categories only while it is open and the user is super-admin.
- Toast messages and when they fire; confirm dialogs.
- Level computation (D8: pending spots count) and every level-derived UI element.
- Admin tab behaviour: search, grant, revoke, categories.

## Acceptance
```bash
npm run verify
npx vitest run src/lib/spotStatus.test.ts
npm run test:e2e
find src/components/profile -name '*.tsx' -exec wc -l {} + | awk '$1>300 && $2!="total"'   # → no output
grep -rn "from 'firebase/" src/components/profile                                          # → none
grep -rn "getLevelInfo(" src/components/profile | wc -l                                    # → ≤ 2 call sites (ProfilePanel, LevelInfoModal)
grep -rn "})()" src/components/profile                                                     # → none (no IIFEs)
```
Add an e2e test `e2e/profile.spec.ts`, signed in as the seeded level-3+ user:
1. Open the profile. The level pill and progress are visible.
2. Switch through the tabs.
3. Open and close the highlight manager.
4. Open the level info modal and close it.
5. As the seeded super-admin: the admin tab shows the admin list.

## Rollback
`git revert` the commit series. No data implications.

## Stop and ask Paul if…
- After T11a the level source differs between the header and the highlight manager (today both use `myAllSpots.length`).
- Any block cannot be moved without changing DOM order or nesting. For example, if SettingsPanel's stacking depends on being a child of the panel root: keep it a child.
