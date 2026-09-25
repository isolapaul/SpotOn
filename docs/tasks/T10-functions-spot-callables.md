# T10 — Functions: spot mutation callables (likes, images, highlights)

**Phase:** 2 · **Depends on:** T09 · **Risk:** med · **Decisions:** D8, D9, D12
**Audit refs:** SEC-09, SEC-10, SEC-11, SEC-19, BUG-10, BUG-11, BUG-18

## Goal
Move the three array-rewriting spot mutations into transactional callables: image likes, adding images, and highlights. Concurrent users then can't lose or forge each other's data, and level perks are enforced on the server. `highlightSpot` keeps its name, but now unifies the two existing highlight systems. It keeps writing the **same fields**, so today's UI keeps working. Legacy image lists are materialised only on a real user action, never on read.

## Context
- **Likes** (`useSpotStore.ts:309-325`): the client rewrites the whole `spotImages` array from local state. No component calls `toggleSpotImageLike` today (grep finds nothing), but the store API exists.
- **Legacy migration** (`useSpotStore.ts:290-307`, called on read at `SpotDetailsPanel.tsx:232`): a spot with `imageUrls` but no or empty `spotImages` becomes `imageUrls.map((url, index) => ({id: \`${spotId}_${index}\`, url, addedAt: now, likes: 0, likedBy: []}))`. There is no `addedBy`, and the placeholder is included if present.
- **Add images** (`useSpotStore.ts:256-288`):
  - `PLACEHOLDER = "/placeholder-spot.jpg"`;
  - `baseUrls` = `imageUrls` unless it is exactly `[PLACEHOLDER]` (then `[]`);
  - `baseSpotImages` = `spotImages` without placeholder entries;
  - limit: `baseUrls.length + new > 20`, which throws `MAX_SPOT_IMAGES`;
  - result: `imageUrls = [...baseUrls, ...new]` and `spotImages = [...baseSpotImages, ...newEntries]`;
  - `primaryImageIndex = 0` only if `baseUrls` was empty;
  - new entries are `{id: \`${Date.now()}_${rand0..9999}\`, url, addedBy: uid, addedAt: Timestamp.now(), likes: 0, likedBy: []}`.
- **Highlight system A (client)**, `useUserStore.highlightSpot/unhighlightSpot` (`:657-753`), called from `ProfilePanel.tsx:602-617`:
  - Checks `user.highlightedSpots.length < maxHighlights` (limit passed in by the caller; no expiry).
  - Writes `users.highlightedSpots: arrayUnion(spotId)` and `spots.{isHighlighted: true, highlighted: arrayUnion({userId, highlightedAt: ISO, expiresAt: ISO +7d})}`.
  - Unhighlight removes the user's entry and sets `isHighlighted: false` if none remain.
- **Highlight system B (callable)**, `functions/src/index.ts:486-606`, called from `SpotDetailsPanel.tsx:332` (owner-only button):
  - The allowance is `questRewards.valentine2026.highlightBonus` only.
  - Active highlights are `questRewards.valentine2026.activeHighlights[]`, filtered by `expiresAt > now`.
  - It rejects if the spot already has an entry by this user.
  - It writes `spots.highlighted: arrayUnion(entry)` and `users.questRewards.valentine2026.activeHighlights: arrayUnion({spotId, highlightedAt, expiresAt})`.
  - Returns `{success: true, message: "Spot highlighted successfully", expiresAt}`.
  - Errors: `unauthenticated`; `invalid-argument` "Spot ID is required"; `not-found` "User not found" / "Spot not found"; `permission-denied` "No highlight bonus available" / "You have reached your highlight limit" / "You have already highlighted this spot".
- **Readers:**
  - `MapView.tsx:249` treats a spot as highlighted if any `highlighted[].expiresAt > now` (ISO string compare).
  - `SpotDetailsPanel.tsx:224` ignores expiry (BUG-10).
  - `ProfilePanel.tsx:545-625` uses `user.highlightedSpots`.
  - `isHighlighted` is written but never read by the UI.
- **D9:** keep honouring `questRewards.valentine2026.highlightBonus`.
- **Storage download URL format:** `https://firebasestorage.googleapis.com/v0/b/<bucket>/o/<url-encoded path>?alt=media&token=<t>`. The emulator uses `http://<FIREBASE_STORAGE_EMULATOR_HOST>/v0/b/<bucket>/o/<path>?alt=media&token=<t>`.
- T11b uploads new spot images to `spot-images/{uid}/{uuid}.{jpg|png|webp}`.
- T09 provides `functions/src/lib/levels.ts` (`maxHighlightsForCount`, with a parity test against `src/lib/levelUtils.ts`).

## Files
- Create:
  - `functions/src/lib/spotImages.ts` (pure): `PLACEHOLDER_URL`, `MAX_SPOT_IMAGES = 20`, `materializeSpotImages`, `planAddImages`, `toggleLikeInImages`, `parseStorageDownloadUrl`.
  - `functions/src/lib/highlights.ts` (pure): `HIGHLIGHT_TTL_MS`, `isActiveEntry`, `computeAllowance`, `planHighlight`, `planUnhighlight`.
  - `functions/src/callables/spotImages.ts`: `toggleImageLike`, `addSpotImages`.
  - `functions/test/spotImages.test.ts`, `functions/test/highlights.test.ts`, `functions/test/storageUrl.test.ts`.
- Modify:
  - `functions/src/callables/highlightSpot.ts`: new logic; also exports `unhighlightSpot`.
  - `functions/src/index.ts`: add exports.
- Delete: none.

## Steps
1. **`lib/spotImages.ts`** (pure). The timestamp is injected, as `now: T`, so there are no firebase imports.
   - `materializeSpotImages(spotId, imageUrls, now)` returns `imageUrls.map((url, index) => ({id: \`${spotId}_${index}\`, url, addedAt: now, likes: 0, likedBy: []}))`. This is **byte-for-byte the shape of `migrateSpotImages`**.
   - `currentImages(spot, spotId, now)`: `spot.spotImages?.length ? spot.spotImages : materializeSpotImages(spotId, spot.imageUrls ?? [], now)`.
   - `planAddImages(spot, spotId, urls, uid, now, idFactory)` returns `{imageUrls, spotImages, primaryImageIndex?}` or throws `"MAX_SPOT_IMAGES"`. It follows the Context algorithm exactly, except that `baseSpotImages` comes from `currentImages(...)` with placeholders filtered out, so legacy spots keep their materialised ids.
   - `toggleLikeInImages(images, imageId, uid)` returns `{images, liked, likes}`; the image not being found is an error. It computes `likes = max(0, likes ± 1)` and adds or removes `uid` in `likedBy` without duplicating it.
   - `parseStorageDownloadUrl(url, {bucket, emulatorHost?})` returns `{path}` or `null`:
     - (a) The URL parses.
     - (b) Either it is `https:` with host `firebasestorage.googleapis.com`, or `emulatorHost` is set and it is `http:` with host equal to `emulatorHost`.
     - (c) The pathname matches `^/v0/b/([^/]+)/o/([^/]+)$`, the bucket equals `bucket`, and `path = decodeURIComponent(m[2])`.
     - (d) `alt=media` is present and `token` is non-empty.
   - `isOwnSpotImagePath(path, uid)`: `path.startsWith(\`spot-images/${uid}/\`)`, and the rest matches `^[0-9a-f-]{36}\.(jpg|png|webp)$`.
2. **`toggleImageLike({spotId, imageId})`**:
   - Require auth. Both ids must be non-empty strings of at most 200 characters, else `invalid-argument`.
   - Transaction: get the spot (`not-found` "Spot not found"); `images = currentImages(spot, spotId, Timestamp.now())`; `toggleLikeInImages` (`not-found` "Image not found"); `tx.update(spot, {spotImages: images})`.
   - Return `{liked, likes}`.
   - Materialising a legacy spot here is a write triggered by a user action, which is acceptable.
3. **`addSpotImages({spotId, urls})`**:
   - Require auth. `urls` is an array of 1–20 distinct strings of at most 2048 characters, else `invalid-argument`.
   - `bucket = JSON.parse(process.env.FIREBASE_CONFIG!).storageBucket`. `emulatorHost = process.env.FUNCTIONS_EMULATOR === "true" ? process.env.FIREBASE_STORAGE_EMULATOR_HOST : undefined`.
   - Every url must pass `parseStorageDownloadUrl` and `isOwnSpotImagePath(path, callerUid)`, else `permission-denied` "Invalid image URL".
   - Every object must exist (`getStorage().bucket().file(path).exists()`), else `failed-precondition` "Image not uploaded".
   - Transaction: get the spot (`not-found`). Reject urls already in `imageUrls` (`invalid-argument`). Run `planAddImages`; `MAX_SPOT_IMAGES` becomes `HttpsError("resource-exhausted", "MAX_SPOT_IMAGES")`. `tx.update` with the planned fields.
   - The `idFactory` is `() => \`${Date.now()}_${Math.floor(Math.random()*10000)}\``, the same format as today.
   - Spot status is **not** checked (today anyone signed in may add photos to any spot).
   - Return `{added: urls.length}`.
4. **`lib/highlights.ts`** (pure; `now` is an injected `Date`):
   - `HIGHLIGHT_TTL_MS = 7*24*60*60*1000`.
   - `isActiveEntry(e, uid, now)`: `e.userId === uid && Date.parse(e.expiresAt) > now.getTime()`.
   - `computeAllowance(spotsCount, questRewards)`: `maxHighlightsForCount(spotsCount) + bonus`, where `bonus = Math.max(0, Math.floor(Number(questRewards?.valentine2026?.highlightBonus) || 0))` (D9).
   - `planHighlight({uid, spotId, spot, candidateSpots, allowance, now})` returns the writes, or a typed error.
   - `planUnhighlight(...)`, as specified below.
5. **`highlightSpot({spotId})`**. Same export name. The **unified model**: the source of truth for "active" is the `spots/{id}.highlighted[]` entry by this user with `expiresAt > now`.
   - Require auth, and a `spotId` string ("Spot ID is required" on failure).
   - `spotsCount = count()` of `spots where createdBy == uid` (live, all statuses, D8), outside the transaction.
   - In a transaction:
     - Read `users/{uid}` (`not-found` "User not found") and the target spot (`not-found` "Spot not found").
     - Build `candidates = unique([...users.highlightedSpots ?? [], ...(questRewards.valentine2026.activeHighlights ?? []).map(h => h.spotId)])`, excluding `spotId`, keeping only strings, capped at 50. Read them with `tx.getAll`.
     - `activeIds` = the candidates that exist and have `isActiveEntry` for this uid.
   - Checks, in this order:
     - the spot is not `approved` → `failed-precondition` "Spot must be approved to highlight";
     - `spot.createdBy !== uid` → `permission-denied` "You can only highlight your own spots";
     - the spot has an active entry by uid → `permission-denied` "You have already highlighted this spot";
     - `allowance === 0` → `permission-denied` "No highlight bonus available";
     - `activeIds.length >= allowance` → `permission-denied` "You have reached your highlight limit".
   - Writes (the same fields and shapes as systems A and B):
     - the spot gets `highlighted = [...(spot.highlighted ?? []).filter(h => h.userId !== uid), {userId: uid, highlightedAt: now.toISOString(), expiresAt: (now + TTL).toISOString()}]` and `isHighlighted: true`;
     - the user gets `highlightedSpots = [...activeIds, spotId]`, which prunes expired or stale ids.
   - `questRewards.valentine2026.activeHighlights` is **read only** from now on (legacy): no new entries are appended.
   - Return `{success: true, message: "Spot highlighted successfully", expiresAt}` (unchanged).
   - Log `{uid, spotId, outcome}` only.
6. **`unhighlightSpot({spotId})`** (new export):
   - Require auth and a `spotId` string.
   - Transaction:
     - Read the user and the spot. If the spot is missing, still clean up the user side.
     - Spot: `highlighted = highlighted.filter(h => h.userId !== uid)` and `isHighlighted = highlighted.length > 0`. Write only if something changed.
     - User: `highlightedSpots` without `spotId`. If `questRewards.valentine2026.activeHighlights` exists, write it back without entries whose `spotId === spotId`, using the field path `questRewards.valentine2026.activeHighlights`.
   - No owner check, so users can always remove their own legacy entries.
   - Return `{success: true}`.
7. **Unit tests** (`functions/test`):
   - Materialise: ids are `${spotId}_${index}`, including the placeholder; the no-`addedBy` shape.
   - `planAddImages`:
     - placeholder-only spot → primary 0;
     - legacy spot keeps its materialised ids;
     - 19 + 2 → `MAX_SPOT_IMAGES`;
     - 18 + 2 → ok;
     - existing primary preserved.
   - Toggle: like, unlike, `likes` never below 0, no duplicate uid, image not found.
   - URL parser:
     - valid prod URL; wrong host; wrong bucket; `http` in prod; emulator URL only with `emulatorHost`;
     - encoded path `spot-images%2F<uid>%2F<uuid>.jpg`; a `..` path; another uid's path; missing token; the legacy flat path `spot-images/123_x.jpg`, which is rejected.
   - Highlights:
     - allowance per level (counts 9, 10, 15, 20) plus bonus;
     - an expired entry is not counted and gets replaced;
     - not approved; not owner; already active; limit reached; legacy `activeHighlights` counted only when the spot entry is active;
     - unhighlight recomputes `isHighlighted`.
8. **`index.ts`**: `export {highlightSpot, unhighlightSpot} from "./callables/highlightSpot"` and `export {toggleImageLike, addSpotImages} from "./callables/spotImages"`.

## Must NOT change
- The export name `highlightSpot`, its input `{spotId}`, and its success return shape.
- Stored shapes:
  - `spots.highlighted[]` entries are `{userId, highlightedAt: ISO string, expiresAt: ISO string}`;
  - `spots.isHighlighted` is a boolean;
  - `users.highlightedSpots` is `string[]`;
  - `spotImages[]` entries are `{id, url, addedBy?, addedAt: Timestamp, likes: number, likedBy: string[]}`;
  - `imageUrls` is `string[]`, and `primaryImageIndex` is a number.
- Legacy image ids are `${spotId}_${index}`, and new image ids keep the `${ms}_${0..9999}` format.
- The placeholder handling and the 20-image limit (D12).
- The Valentine `highlightBonus` stays honoured (D9).
- All T08/T09 exports.

## Acceptance
```bash
npm run verify:fn
npm --prefix functions test            # spotImages, highlights, storageUrl tests green
npm run verify
node -e "const m=require('./functions/lib/index.js');for(const k of ['highlightSpot','unhighlightSpot','toggleImageLike','addSpotImages','onSpotApproved','onReviewAdded','onSpotFavorited','onNewPendingSpot']) if(!m[k]){console.error('missing',k);process.exit(1)}"
! grep -n "arrayUnion" functions/src/callables/highlightSpot.ts   # all writes are computed inside the transaction
npm run test:e2e                       # existing UI still works (client unchanged until T11b)
```

## Rollback
`git revert`. If deployed: redeploy the previous tag, which deletes the new functions. While old clients are live, the reverted `highlightSpot` must be the T08 version. The data written by the new logic uses the same shapes, so nothing needs cleaning.

## Stop and ask Paul if…
- The owner-only and approved-only highlight rules must not apply. Today the callable accepts any spot (the UI only offers own spots).
- `FIREBASE_CONFIG.storageBucket` in the emulator differs from the client's `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`, so the URL check fails in e2e.
- Legacy spots are found whose `spotImages` is non-empty but inconsistent with `imageUrls`, beyond placeholders.
