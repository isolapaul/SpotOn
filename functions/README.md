# SpotOn Cloud Functions

Server-side logic for SpotOn: admin management, usernames and public profiles, spot image likes and additions, spot highlights, moderation (rejections, removals, edit and photo review, the in-app inbox), account deletion and push notifications.
Together with the Firestore/Storage rules (`firestore.rules`, `storage.rules` in the repository root) these functions are the authorization boundary; UI checks are only for user experience.

## Runtime

- Firebase Functions v2 (`firebase-functions` 7), `firebase-admin` 14
- Node 22 (`engines.node`)
- Region `europe-west3` for every function (`setGlobalOptions` in `src/lib/app.ts`)
- `src/index.ts` only re-exports; the code lives in `src/triggers/`, `src/callables/` and `src/lib/` (shared helpers; the pure ones are unit-tested in `test/`)

## Exported functions

| Function | Trigger type | What it does | Who can call it |
|---|---|---|---|
| `onSpotApproved` | Firestore trigger (`spots/{spotId}` updated) | Tells the spot's creator (inbox + push) when its status changes from pending to approved | Nobody (Firestore event) |
| `onSpotResubmitted` | Firestore trigger (`spots/{spotId}` updated) | Notifies all admins when an owner resubmits a rejected spot (rejected → pending) | Nobody (Firestore event) |
| `onSpotEditProposed` | Firestore trigger (`spotEdits/{spotId}` written) | Notifies all admins when an owner's edit proposal starts waiting for review | Nobody (Firestore event) |
| `onReviewAdded` | Firestore trigger (`spots/{spotId}` updated) | Notifies the spot's creator about a new review (not for reviews of their own spot) | Nobody (Firestore event) |
| `onNewPendingSpot` | Firestore trigger (`spots/{spotId}` created) | Notifies all admins about a new pending spot | Nobody (Firestore event) |
| `onSpotFavorited` | Firestore trigger (`users/{userId}` updated) | Notifies a spot's creator when someone adds it to their favourites | Nobody (Firestore event) |
| `syncPublicProfile` | Firestore trigger (`users/{uid}` written) | Mirrors the public fields of a user into `publicProfiles/{uid}` | Nobody (Firestore event) |
| `syncSpotsCount` | Firestore trigger (`spots/{spotId}` written) | Recounts `spotsCount` (all statuses) on `users/{uid}` and `publicProfiles/{uid}` when a spot is created, deleted or changes owner | Nobody (Firestore event) |
| `syncAdminFlag` | Firestore trigger (`admins/{uid}` written) | Keeps `publicProfiles/{uid}.isAdmin` in line with `admins/{uid}` | Nobody (Firestore event) |
| `highlightSpot` | Callable | Highlights one of the caller's approved spots for 7 days, within the caller's level allowance | Signed-in users (own, approved spots) |
| `unhighlightSpot` | Callable | Removes the caller's highlight from a spot | Signed-in users |
| `toggleImageLike` | Callable | Likes or unlikes one image of a spot, in a transaction | Signed-in users |
| `addSpotImages` | Callable | Adds already uploaded images (the caller's own `spot-images/{uid}/…` objects) to a spot, up to 20 images. Admins and the owner of a spot under review add them directly; everyone else's become `photoSubmissions` for an admin (item 4), at most 5 waiting per user and spot | Signed-in users |
| `approveSpot` | Callable | Approves a pending spot (`onSpotApproved` then tells the owner) | Admins |
| `rejectSpot` | Callable | Rejects a pending spot with a reason (1–500 characters, stored on the spot for its owner) and tells the owner | Admins |
| `removeSpot` | Callable | Deletes a spot with a reason: its photo files, pending edit and photo submissions go too; tells the owner | Admins |
| `reviewSpotEdit` | Callable | Applies an owner's proposed edit of an approved spot (removed photo files are deleted), or rejects it with a reason; tells the owner. The admin names the reviewed version, so a changed proposal is never applied unseen | Admins |
| `reviewPhotoSubmission` | Callable | Adds a waiting photo to its spot, or rejects it with a reason (the file is deleted); tells the uploader | Admins |
| `claimUsername` | Callable | Claims a unique username through `usernames/{name}` in a transaction and frees the old one | Signed-in users (for themselves) |
| `updateNameStyle` | Callable | Sets the custom name colour/font from an allowlist | Signed-in users at level 5 |
| `lookupUserByEmail` | Callable | Finds a user by email for the admin management screen | Super admin only |
| `addAdmin` | Callable | Creates `admins/{uid}` with `role: 'admin'` for a user found by email | Super admin only |
| `removeAdmin` | Callable | Deletes an `admins/{uid}` document (a super admin cannot be removed) | Super admin only |
| `deleteCategory` | Callable | Deletes a category only while no spot and no waiting edit uses it | Super admin only |
| `getProfile` | Callable | What a visitor may see of a profile: approved spot ids, saved spot ids if shared; private profiles only for accepted followers; the caller's follow state | Anyone |
| `followUser` | Callable | Follows a public profile, or sends a follow request to a private one (inbox + push) | Signed-in users |
| `unfollowUser` | Callable | Unfollows, or cancels the caller's request | Signed-in users |
| `respondFollowRequest` | Callable | Accepts or declines a request to the caller (accept: inbox + push to the requester) | Signed-in users |
| `removeFollower` | Callable | Removes someone who follows the caller | Signed-in users |
| `searchUsers` | Callable | Username prefix search: 2+ characters, 10 results, 20 calls a minute per user | Signed-in users |
| `deleteAccount` | Callable | Deletes the caller's account: reviews, photos on others' spots, likes, highlights, profile files, the inbox, edit proposals and photo submissions, username, user doc and Auth user; own spots stay under the `deleted-user` placeholder owner, with their photos moved out of the user's folder | Signed-in users, not admins (the typed confirmation must match) |

The super admin is the `admins/{uid}` document with `role: 'super'`. It exists already; to recreate it (for example on a new project), promote an existing Auth user with
`npx tsx scripts/bootstrap-super-admin.ts --project <PROJECT_ID> --email <EMAIL>` (dry run; add `--apply` to write). The script uses Application Default Credentials.

> **Never rename or drop an exported function; renaming deletes it on deploy.**
> The deployed function with the old name is removed and clients that still call it break.

## Inbox

Moderation decisions reach the owner (or uploader) twice: a push (following the "spot status" notification setting) and an item in `users/{uid}/inbox` (`lib/inbox.ts`: type, spot id and name, the reason; at most 50 kept). The app shows the inbox in its notification centre, so a reason stays readable after the push and on every device.

## Parameters

| Param | Purpose | Where it is set |
|---|---|---|
| `APP_URL` | Public base URL of the web app, used as the notification click link (only when it starts with `https://`) | Emulator: `functions/.env.demo-spoton` (`http://localhost:3000`, committed, not a secret). Production: entered at the first deploy and saved to `functions/.env.<PROJECT_ID>`, which is git-ignored and never committed |

## Commands

Run from the repository root (or `cd functions` and drop `--prefix functions`; `npm run verify:fn` is a root script):

```bash
npm --prefix functions ci            # install
npm --prefix functions run build     # tsc → functions/lib
npm --prefix functions run lint      # ESLint
npm --prefix functions test          # unit tests (Vitest, functions/test)
npm run verify:fn                    # build + lint + tests (the gate when functions/ changed)
```

Emulator (project id `demo-spoton`; never a real project):

```bash
npm --prefix functions run build
npx firebase emulators:start --only auth,firestore,storage,functions --project demo-spoton
```

`npm run test:e2e` in the repository root builds the functions and runs the full Playwright suite against these emulators.

## Deploy

```bash
firebase deploy --only functions
```

Paul only, as a manual step (see [`docs/deploy.md` §16](../docs/deploy.md#16-firebase-deploys-functions-rules-indexes)). Agents never deploy.
