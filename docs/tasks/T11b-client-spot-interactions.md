# T11b — Client: spot interactions via callables, review PII, upload paths

**Phase:** 2 · **Depends on:** T10, T11a · **Risk:** med-high · **Decisions:** D8, D9, D12, D15
**Audit refs:** SEC-02, SEC-03, SEC-05, SEC-09, SEC-10, SEC-11, BUG-10, BUG-11, BUG-18

## Goal
Every client write that T12 will forbid either moves to the T10 callables or is reshaped to fit the rules:
- likes, adding images, highlight and unhighlight become callables;
- new spot images go to `spot-images/{uid}/{uuid}.{ext}`;
- reviews stop carrying email or spoofable style metadata;
- review badges render from `publicProfiles`;
- viewing a legacy spot no longer writes to Firestore.

This spec also fixes the **exact field sets** of the remaining direct owner/admin writes, so that T12's rules can match them 1:1.

## Context
- **Uploads:** `useSpotStore.ts:116-135` uploads to `spot-images/${ts}_${rand}_${file.name}` (no uid, user-controlled name, no explicit contentType).
  - Compression options `{maxSizeMB: 0.3, maxWidthOrHeight: 1280, useWebWorker: false}` (`:108-112`).
  - Profile images: `useUserStore.ts:602-654`, paths `profile-pictures/{uid}/…` and `profile-banners/{uid}/…`, with no explicit contentType.
  - T12 storage rules require `image/(jpeg|png|webp)`, less than 5 MB, owner folder.
- **Reviews:** `SpotDetailsPanel.tsx:353-363` sends `userId, userName, userEmail, userPhoto, rating, comment, userSpotsCount, customNameColor, customNameFont`. `useSpotStore.addReview` (`:228-254`) adds `id: ${userId}_${Date.now()}` and `createdAt: Timestamp.now()`, strips `undefined`, and writes `reviews: arrayUnion(review)`, which appends.
  - The duplicate-review check is client-side (`:346-349`); rules cannot enforce it (D15; see T12).
- **Review badge:** `SpotDetailsPanel.tsx:65-92` puts `review.customNameFont` into `className` (SEC-05) and shows the level from `review.userSpotsCount ?? meta.spotsCount` (`:777-778`). After T11a, the admin badge uses `meta.isAdmin`, and `reviewerMeta` comes from `publicProfiles`.
- **Legacy images:** `SpotDetailsPanel.tsx:227-234` calls `migrateSpotImages` on view, a write on read (BUG-18). Gallery code at `:140-152`.
- **Highlights:** `SpotDetailsPanel.tsx:325-340` calls `httpsCallable(functions,'highlightSpot')` directly. `ProfilePanel.tsx:602-617` calls `useUserStore.highlightSpot(spotId, maxHighlights)` / `unhighlightSpot` (client writes). `SpotDetailsPanel.tsx:224` ignores expiry (BUG-10).
- T10 callables: `toggleImageLike({spotId,imageId})`, `addSpotImages({spotId, urls})` (`resource-exhausted` `"MAX_SPOT_IMAGES"`), `highlightSpot({spotId})` and `unhighlightSpot({spotId})`. Server messages are shown via `error.message` as today.
- T11a already moved `addSpot`'s status decision to the `isAdmin` store flag (`status: isAdmin ? 'approved' : 'pending'`). This task only verifies it. T12 rules enforce it.
- Direct writes that **stay direct** (rules-guarded in T12), listed with their exact payloads:

  | Operation | Who (UI) | Call | Keys written |
  |---|---|---|---|
  | `addSpot` | signed in | `addDoc(spots)` | `name, category, description, location{lat,lng}, createdBy, createdByName, createdByPhoto, imageUrls, spotImages, primaryImageIndex, status, createdAt(serverTimestamp)` |
  | `addReview` | signed in | `updateDoc` | `reviews` (append of one `{id, userId, userName, userPhoto?, rating, comment, createdAt}`) |
  | `approveSpot` | admin | `updateDoc` | `status: 'approved'` |
  | `deleteSpot` | admin | `deleteDoc` | none (delete) |
  | `updateSpotName` | admin, or owner when `approved` | `updateDoc` | `name` |
  | `updateSpotDescription` | admin, or owner when `approved` | `updateDoc` | `description` |
  | `setPrimaryImage` | admin, or owner when `approved` | `updateDoc` | `primaryImageIndex` |
  | `deleteSpotImage` | admin, or owner when `approved` | `updateDoc` | `imageUrls, spotImages, primaryImageIndex`. Only removes entries, or sets `imageUrls` to `['/placeholder-spot.jpg']` when the last one is removed. `spotImages` may be unchanged or `[]` for legacy spots. |
  | category add (ProfilePanel `:181`) | super admin | `addDoc(categories)` | `name, icon, createdAt` |
  | profile picture | owner | `updateDoc(users)` | `profilePictureURL, photoURL` |
  | profile banner | owner | `updateDoc(users)` | `profileBannerURL` |

## Files
- Create: `src/lib/spotImages.ts` and `src/lib/spotImages.test.ts`, `src/lib/highlights.ts` and `src/lib/highlights.test.ts`, and `e2e/spot-interactions.spec.ts` (T04's e2e dir).
- Modify:
  - `src/store/useSpotStore.ts`, `src/store/useUserStore.ts`;
  - `src/components/SpotDetailsPanel.tsx`, `src/components/ProfilePanel.tsx`;
  - `scripts/seed-emulator.ts` (only if steps 9 and 10 need fixtures that are missing).
- Delete: none.

## Steps
1. **`src/lib/spotImages.ts`** (pure, `import type` only):
   - `PLACEHOLDER_URL = '/placeholder-spot.jpg'` and `MAX_SPOT_IMAGES = 20`.
   - `type DisplaySpotImage = Omit<SpotImage,'addedAt'> & { addedAt?: SpotImage['addedAt'] }`.
   - `getSpotImages(spot): DisplaySpotImage[]`: `spot.spotImages?.length ? spot.spotImages : (spot.imageUrls ?? []).map((url, index) => ({id: \`${spot.id}_${index}\`, url, likes: 0, likedBy: []}))`. The ids are identical to `migrateSpotImages` and to T10's `materializeSpotImages`.
   - `realImageCount(spot)`: 0 if `imageUrls` is exactly `[PLACEHOLDER_URL]`, else `imageUrls?.length ?? 0`.
   - `extForMime(mime): 'jpg' | 'png' | 'webp' | null`.

   Tests: legacy materialisation (including the placeholder at index 0), passthrough when `spotImages` exists, `realImageCount` edges, and `extForMime`.
2. **`src/lib/highlights.ts`** (pure):
   - `isActiveHighlight(entry, now = new Date())`: `Date.parse(entry.expiresAt) > now.getTime()`.
   - `isHighlightedBy(spot, uid, now?)`: `(spot.highlighted ?? []).some(h => h.userId === uid && isActiveHighlight(h, now))`.

   Tests: expired, active, another user, missing array.
3. **`useSpotStore.ts`**:
   - (a) `compressAndUpload(file, uid)`:
     - compress with the unchanged options;
     - if `extForMime(compressed.type)` is null, re-run `imageCompression(file, {...IMAGE_COMPRESSION_OPTIONS, fileType: 'image/jpeg'})`;
     - path `spot-images/${uid}/${crypto.randomUUID()}.${ext}`;
     - `uploadBytes(ref, blob, {contentType: blob.type})`;
     - the returned `spotImage.id` stays `${Date.now()}_${Math.floor(Math.random()*10000)}`, and its other fields are unchanged.
   - (b) `addSpot`: its payload keys are exactly the table row above. Verify that the status comes from the `isAdmin` argument (T11a).
   - (c) `addReview(spotId, review: NewReview)` with `type NewReview = {userId: string; userName: string; userPhoto?: string; rating: number; comment: string}`. It builds `{...review, id: \`${userId}_${Date.now()}\`, createdAt: Timestamp.now()}`, strips `undefined`, and appends with `arrayUnion` (unchanged).
   - (d) `Review` type: `userEmail`, `userSpotsCount`, `customNameColor` and `customNameFont` become optional, with a comment `// legacy, read-only; never written`.
   - (e) `addSpotImages(spotId, files, uid)`:
     - if `realImageCount(spot) + files.length > MAX_SPOT_IMAGES`, throw `new Error('MAX_SPOT_IMAGES')` before uploading (unchanged UX);
     - upload all files with (a);
     - call `httpsCallable(functions,'addSpotImages')({spotId, urls})`, mapping `functions/resource-exhausted` to `new Error('MAX_SPOT_IMAGES')`;
     - no local array rewrite (the spots listener delivers the change).
   - (f) `toggleSpotImageLike(spotId, imageId)` calls the `toggleImageLike` callable. Drop the `userId` parameter.
   - (g) Delete `migrateSpotImages` from the store and its interface.
   - (h) `approveSpot`, `deleteSpot`, `updateSpotName`, `updateSpotDescription`, `setPrimaryImage` and `deleteSpotImage` stay direct and unchanged, with the payloads exactly as in the table.
4. **`useUserStore.ts`**:
   - `highlightSpot(spotId)` calls the `highlightSpot` callable. Drop the `maxHighlights` parameter.
     - On success: `user.highlightedSpots = [...new Set([...(user.highlightedSpots ?? []), spotId])]`.
     - Errors propagate, and the message is the server's.
   - `unhighlightSpot(spotId)` calls the `unhighlightSpot` callable, then removes the id locally.
   - `updateProfilePicture` / `updateProfileBanner`:
     - if `extForMime(compressed.type)` is null, re-compress with `fileType: 'image/jpeg'`;
     - `uploadBytes(ref, blob, {contentType: blob.type})`;
     - the paths and Firestore writes are unchanged.
5. **`SpotDetailsPanel.tsx`**:
   - (a) Delete the migrate effect. `sortedSpotImages` = `getSpotImages(spot).filter(i => i.url !== PLACEHOLDER_URL)`, then sorted as today (the comparator already tolerates a missing `addedAt`).
   - (b) `isHighlightedByUser` = `isHighlightedBy(spot, user.uid)`.
   - (c) `handleHighlightSpot` calls `useUserStore.highlightSpot(spot.id)`. The toasts are unchanged, including `error?.details?.message || error?.message || 'Error highlighting spot'`. Remove the imports of `httpsCallable`, `functions` and `firebase/*` if they become unused.
   - (d) `handleSubmitReview` sends only `{userId, userName: user.username || t('anonymous'), userPhoto: user.profilePictureURL || user.photoURL, rating, comment}`. The review textarea gets `maxLength={1000}` (no visible change).
   - (e) `reviewerMeta` also stores `customNameFont` from the public profile. `ReviewerBadge` props become `{meta: {username?, spotsCount?, customNameColor?, customNameFont?, isAdmin?}, review: Review}` and render:
     - name `meta.username || review.userName`;
     - `spotsCount = meta.spotsCount ?? 0`;
     - colour `getUserNameColor(spotsCount, meta.customNameColor ?? undefined)`;
     - font class = `meta.customNameFont` if it is one of `CUSTOM_NAME_FONTS.map(f => f.value)`, else `'font-sans'`;
     - the admin badge when `meta.isAdmin === true`.

     `review.userEmail`, `review.userSpotsCount`, `review.customNameColor` and `review.customNameFont` are **never read**.
6. **`ProfilePanel.tsx`**, in the highlight panel:
   - `isHighlighted = isHighlightedBy(spot, user.uid)`;
   - the "`N / max kiemelve`" count and the disable check use `myAllSpots.filter(s => isHighlightedBy(s, user.uid)).length` instead of `user.highlightedSpots.length`;
   - the call is `highlightSpot(spot.id)`;
   - the texts are unchanged.
7. **Grep for leftovers:** no `userEmail` writes, and no `migrateSpotImages`.
8. **Unit tests:** as in steps 1 and 2. `npm run verify` runs them.
9. **e2e (`spot-interactions.spec.ts`).** It runs inside T04's emulator harness, and uses `firebase-admin` in the Node test context (`FIRESTORE_EMULATOR_HOST` is set by `emulators:exec`) for data assertions:
   - (1) `user@spoton.test` adds a spot with one JPEG fixture. The new doc has `status 'pending'`, and its `imageUrls[0]` decodes to a path starting with `spot-images/<uid>/` and ending `.jpg`.
   - (2) The user adds a 4★ review to a seeded approved spot. It is visible in the UI, and the stored last review's keys are a subset of `{id,userId,userName,userPhoto,rating,comment,createdAt}`.
   - (3) Opening a seeded **legacy** spot (only `imageUrls`) leaves the stored doc with no `spotImages` field (no write on read).
   - (4) Adding a photo to that legacy spot gives `spotImages` ids `${spotId}_0…` followed by the new entry, and `imageUrls` grew by 1.
   - (5) `admin@spoton.test` approves the pending spot from (1). The status becomes `approved`.
   - (6) The level-5 seeded user (T09 seed) highlights one of their approved spots from SpotDetailsPanel. The success toast appears, the spot's `highlighted` has an entry with `expiresAt` about 7 days out, and `users.highlightedSpots` contains the id.
10. **Seed:** only if missing, add a legacy approved spot with `imageUrls` only, and give the level-5 user an approved spot.

## Must NOT change
- UI, layout and texts, except `maxLength={1000}` on the review textarea (no visible change). Toast messages are unchanged.
- The stored shapes of `spots` (see the T10 Must-NOT list), `reviews[]` elements (minus the removed keys), `users.highlightedSpots`, and the spot image ids.
- Legacy data keeps rendering: spots with only `imageUrls`, reviews containing `userEmail` and the other legacy keys, and spots without `spotImages` or `reviews`.
- The image limit of 20 and the placeholder behaviour (D12).
- The payloads of the direct owner/admin writes (the table above). T12 depends on them.

## Acceptance
```bash
npm run verify
npm run verify:fn
npm run test:e2e                     # includes e2e/spot-interactions.spec.ts and T11a's spec
! grep -rn "userEmail:" src          # never written (type field is `userEmail?:`)
! grep -rn "migrateSpotImages" src
! grep -rn "review\.\(customNameFont\|customNameColor\|userSpotsCount\|userEmail\)" src/components
grep -n "randomUUID" src/store/useSpotStore.ts
! grep -n "file.name" src/store/useSpotStore.ts      # no user-controlled names in spot paths
grep -n "contentType" src/store/useSpotStore.ts src/store/useUserStore.ts
! grep -rn "highlighted: arrayUnion\|isHighlighted: " src/store   # no client highlight writes
```

## Rollback
`git revert`. The data is compatible in both directions: the same shapes; legacy spots are simply not materialised. Do not roll back after T12 rules are live, because the old client's writes would be denied.

## Stop and ask Paul if…
- Reviews on legacy data should keep showing the review-time level or colour (`review.userSpotsCount` / `customNameColor`) when a reviewer has no public profile. The default shows level 1 and no custom style, because those fields are spoofable (SEC-05).
- The JPEG fallback for non-JPEG/PNG/WebP uploads (such as GIF) is not acceptable.
- The spots listener does not refresh the open details panel after `addSpotImages`, and the e2e shows a visible regression compared with today.
