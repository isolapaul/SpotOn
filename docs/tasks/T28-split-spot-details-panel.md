# T28 — Split SpotDetailsPanel

**Phase:** 5 · **Depends on:** T26 · **Risk:** med · **Decisions:** —
**Audit refs:** ARCH-02, BUG-09, BUG-17, DUP-12

## Goal
- Break the ~870-line `SpotDetailsPanel.tsx` into focused components under `src/components/spot-details/`, each at most 300 lines.
- Fix BUG-09: the favourite state is copied from props and never re-synced.
- Fix BUG-17: effects re-run because they depend on the state they set.

Everything else is identical.

## Context
Line ranges below are from `eee5668`. T11b, T21–T26 changed the file:
- migrate-on-read removed;
- reviews without `userEmail`;
- BUG-03/-05/-12 fixed;
- PanelShell, StarRating and swipe primitives;
- `usePublicProfile(s)`;
- `useIsAdmin`.

**Map by landmark.**

| Landmark (current lines) | Content | Target |
|---|---|---|
| `useSwipeDismiss`, `StarRow` (:23-63) | replaced in T25 | — |
| `ReviewerBadge` (:65-92) | name, level and admin badge per review | `spot-details/ReviewerBadge.tsx` |
| review form state `rating`, `comment`, `isSubmitting` (:100-103); `handleSubmitReview` (:342-372); JSX `{/* Add review form */}` (:695-733) | review form | `spot-details/ReviewForm.tsx` |
| `isFavorite` state (:106); `handleFavoriteToggle` (:315-323) | favourite (BUG-09) | `useFavoriteToggle` (T26) in `SpotHero` |
| `isApproving`, `handleApprove` (:107, :374-385, T21 timer ref); JSX `{/* Admin status & approve */}` (:531-550) | admin status card | `spot-details/AdminActions.tsx` → `AdminStatusCard` |
| `handleDeleteSpot` (:443-452); JSX `{/* Delete spot (admin only) */}` (:658-666) | delete | `spot-details/AdminActions.tsx` → `DeleteSpotButton` (a second named export, rendered at its original DOM position) |
| `isHighlighting`, `isHighlightedByUser` (:108-109, :221-225); `handleHighlightSpot` (:325-340) | highlight | `spot-details/useSpotHighlight.ts` (hook), consumed by SpotHero and SpotTitle |
| `isUploadingPhotos`, `photoInputRef` (:110, :131); `handleAddPhotos` (:396-411); JSX `{/* Add photos */}` (:735-753) | add photos card | `spot-details/AddPhotosCard.tsx` |
| `isEditing`, `editName`, `editDescription` (:113-115); `handleSaveEdit` (:413-422) | edit state, spanning **two** DOM places (title input :555-561, description editor :597-614) | `spot-details/useSpotEdit.ts` (hook, owned by the shell) + `SpotTitle.tsx` + `EditForm.tsx` |
| `showManageImages` (:116); `handleSetPrimaryImage`, `handleDeleteImage` (:424-441); JSX `{/* Manage images */}` (:622-656) | image manager (T21 logic) | `spot-details/ImageManager.tsx` |
| gallery state (:118-121, :137), `nextImage`/`prevImage` (:154-160), keyboard effect (:169-179); JSX `{/* Fullscreen gallery modal */}` (:814-868) | gallery | `spot-details/Gallery.tsx` (owns index and swipe; props `urls`, `open`, `startIndex`, `onClose`, `alt`) |
| `ignoreHeroClicks` effect (:162-167); JSX `{/* Hero Image */}` incl. top action bar and category badge (:474-525) | hero | `spot-details/SpotHero.tsx` |
| `sortedSpotImages`, `allGalleryImages`, `heroImageUrl` (:139-152, :306-310) | already `lib/spotImages` (T23) | called in shell, passed as props |
| creator effect (:188-219), `creatorDisplayName`/colour/level (:311-313); JSX `{/* Meta info */}` (:668-689) | date + creator | `spot-details/CreatorInfo.tsx` (uses `usePublicProfile`) |
| reviewer-meta effect (:257-287); JSX `{/* Reviews list */}` (:755-796) | review list | `spot-details/ReviewList.tsx` (uses `usePublicProfiles`) |
| JSX `{/* Reviews section */}` wrapper (:691-797) | heading + form + photos + list | `spot-details/ReviewsSection.tsx` |
| JSX `{/* Title & rating */}` (:552-583) | title / edit input, highlight star, edit button, rating row | `spot-details/SpotTitle.tsx` |
| JSX `{/* Location */}` (:585-594), `{/* CTA */}` (:799-807), `getDateLocale`/`formatDate` (:291-297) | small | `spot-details/SpotLocation.tsx`; CTA stays in the shell; date helpers → `src/lib/dates.ts` (pure, tested) |
| `if (!spot) return null`, `canEdit`, `isOwner`, `navigationUrl`, `averageRating` (:289, :299-305) | orchestration | `spot-details/SpotDetailsPanel.tsx` |

**Resulting tree:**
```
src/components/spot-details/
  SpotDetailsPanel.tsx   SpotHero.tsx   SpotTitle.tsx   SpotLocation.tsx   EditForm.tsx
  AdminActions.tsx       ImageManager.tsx   CreatorInfo.tsx   ReviewsSection.tsx
  ReviewForm.tsx         ReviewList.tsx     ReviewerBadge.tsx AddPhotosCard.tsx   Gallery.tsx
  useSpotEdit.ts         useSpotHighlight.ts
```
`src/components/SpotDetailsPanel.tsx` becomes a re-export.

**State ownership:**
- Shell: `useSpotEdit`, gallery `open`/`startIndex`, `useSpotHighlight`, `useIsAdmin`.
- `ReviewForm`: rating, comment, submitting.
- `AddPhotosCard`: uploading, input ref.
- `ImageManager`: `showManageImages`.
- `Gallery`: current index and swipe.
- `SpotHero`: `ignoreHeroClicks` (reset on `spot.id`).
- `AdminStatusCard`: `isApproving` and the T21 close timer.

**BUG-09 (intended change).** `isFavorite` is initialised from props once. The component is always mounted and receives `spot = null` at mount, so the heart starts as "not favourite" for every spot, even saved ones. After toggling, it flips locally and never re-syncs. **Fix:** `useFavoriteToggle(spot.id)` (T26), which reads `user.savedSpots` from the store. The heart now correctly shows saved spots and stays in sync with the info window and profile.

**BUG-17 (intended change).** The effects with deps `[spot, uploaderNames, migrateSpotImages, t]` (:255) and `[spot?.reviews, reviewerMeta]` (:287) re-ran after every state update they caused. After T26 those fetches live in `usePublicProfile(s)`, so no component state feeds back into deps. Also remove any remaining effect whose deps include state it sets. Verify with the grep in Acceptance and by review.

## Files
- Create: every file in the tree above, plus `src/lib/dates.ts` and `src/lib/dates.test.ts`.
- Modify: `src/components/SpotDetailsPanel.tsx` (becomes a re-export).

## Steps
1. Create `lib/dates.ts`: `dateLocale(lang)` (`hu-HU`, `de-DE`, `en-US`) and `formatLongDate(ts, lang, unknownLabel)`. Test them against the old functions: Timestamp-like with `toDate`, a Date, a number, and a falsy value.
2. Create the hooks `useSpotEdit(spot)` → `{ isEditing, editName, setEditName, editDescription, setEditDescription, start, cancel, save }` (T22's toast semantics) and `useSpotHighlight(spot)`.
3. Extract the leaves first (ReviewerBadge, SpotLocation, CreatorInfo, AddPhotosCard, ReviewForm, ReviewList), then SpotTitle and EditForm, ImageManager, AdminActions, SpotHero, then Gallery. **Commit per group**, with `npm run verify` and `npm run test:e2e` green each time.
4. Apply the BUG-09 fix in SpotHero; delete the local `isFavorite` state.
5. Keep all hooks above the `if (!spot) return null` in the shell, as today. Children receive a non-null `spot`.
6. DOM order in the scroll area must stay:
   1. admin status card
   2. title and rating
   3. location
   4. description or edit form
   5. image manager
   6. delete button
   7. meta grid
   8. reviews section (heading, form, add-photos, list)
   9. CTA
   10. spacer
7. Check line counts: every file ≤ 300 lines.

## Must NOT change
- Rendered DOM, classes, texts, aria-labels (`Close spot details`, `Close`, `Share`, favourite labels, `Go to image N`), `role="button"` on the hero, and the ids `review-comment`.
- Swipe behaviour (either direction >100 px closes), gallery swipe and keys (←, →, Esc), and the 300 ms hero click guard.
- Toasts, confirm dialogs, the one-review-per-user check, the approve → close-after-1 s flow (with the T21 cleanup), and the highlight callable call.
- `canEdit` rules (admin, or owner of an approved spot) and admin-only delete.
- Image ordering and hero/gallery selection (T23 functions).

## Acceptance
```bash
npm run verify
npx vitest run src/lib/dates.test.ts
npm run test:e2e
find src/components/spot-details -name '*.ts*' -exec wc -l {} + | awk '$1>300 && $2!="total"'  # → no output
grep -rn "from 'firebase/" src/components/spot-details                                        # → none
grep -rn "useState(spot" src/components/spot-details                                          # → none (no prop copies)
```
Add e2e `e2e/spot-details.spec.ts`:
- **Favourite sync (BUG-09).** Signed in, with a spot seeded as saved in `users/{uid}.savedSpots`:
  1. Open it from the map info window → details. The heart shows filled (`aria-label` "Remove from favorites").
  2. Toggle it off, close, and reopen: the heart shows empty.
- **Review.** Add a review → a toast appears in the notification centre → after reopening, the review is listed.
- **Gallery.** Open the gallery, press ArrowRight: the counter reads `2 / N`.

## Rollback
`git revert` the commit series. No data implications.

## Stop and ask Paul if…
- The post-T11b code renders an admin badge per review from a data source you cannot find in `usePublicProfiles`.
- Splitting would change DOM order. For example, if the delete button must move next to the status card to share state, keep it where it is and pass props instead.
