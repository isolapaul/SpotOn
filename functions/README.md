# SpotOn Cloud Functions

Server-side logic for SpotOn: admin management, usernames and public profiles, spot image likes and additions, spot highlights, and push notifications.
Together with the Firestore/Storage rules (`firestore.rules`, `storage.rules` in the repository root) these functions are the authorization boundary; UI checks are only for user experience.

## Runtime

- Firebase Functions v2 (`firebase-functions` 7), `firebase-admin` 14
- Node 22 (`engines.node`)
- Region `europe-west3` for every function (`setGlobalOptions` in `src/lib/app.ts`)
- `src/index.ts` only re-exports; the code lives in `src/triggers/`, `src/callables/` and `src/lib/` (shared helpers; the pure ones are unit-tested in `test/`)

## Exported functions

| Function | Trigger type | What it does | Who can call it |
|---|---|---|---|
| `onSpotApproved` | Firestore trigger (`spots/{spotId}` updated) | Notifies the spot's creator when its status changes from pending to approved | Nobody (Firestore event) |
| `onReviewAdded` | Firestore trigger (`spots/{spotId}` updated) | Notifies the spot's creator about a new review (not for reviews of their own spot) | Nobody (Firestore event) |
| `onNewPendingSpot` | Firestore trigger (`spots/{spotId}` created) | Notifies all admins about a new pending spot | Nobody (Firestore event) |
| `onSpotFavorited` | Firestore trigger (`users/{userId}` updated) | Notifies a spot's creator when someone adds it to their favourites | Nobody (Firestore event) |
| `syncPublicProfile` | Firestore trigger (`users/{uid}` written) | Mirrors the public fields of a user into `publicProfiles/{uid}` | Nobody (Firestore event) |
| `syncSpotsCount` | Firestore trigger (`spots/{spotId}` written) | Recounts `spotsCount` (all statuses) on `users/{uid}` and `publicProfiles/{uid}` when a spot is created, deleted or changes owner | Nobody (Firestore event) |
| `syncAdminFlag` | Firestore trigger (`admins/{uid}` written) | Keeps `publicProfiles/{uid}.isAdmin` in line with `admins/{uid}` | Nobody (Firestore event) |
| `highlightSpot` | Callable | Highlights one of the caller's approved spots for 7 days, within the caller's level allowance | Signed-in users (own, approved spots) |
| `unhighlightSpot` | Callable | Removes the caller's highlight from a spot | Signed-in users |
| `toggleImageLike` | Callable | Likes or unlikes one image of a spot, in a transaction | Signed-in users |
| `addSpotImages` | Callable | Adds already uploaded images (the caller's own `spot-images/{uid}/…` objects) to a spot, up to 20 images | Signed-in users |
| `claimUsername` | Callable | Claims a unique username through `usernames/{name}` in a transaction and frees the old one | Signed-in users (for themselves) |
| `updateNameStyle` | Callable | Sets the custom name colour/font from an allowlist | Signed-in users at level 5 |
| `lookupUserByEmail` | Callable | Finds a user by email for the admin management screen | Super admin only |
| `addAdmin` | Callable | Creates `admins/{uid}` with `role: 'admin'` for a user found by email | Super admin only |
| `removeAdmin` | Callable | Deletes an `admins/{uid}` document (a super admin cannot be removed) | Super admin only |

The super admin is the `admins/{uid}` document with `role: 'super'`; it is created once with `scripts/bootstrap-super-admin.ts` (see `docs/security-rollout.md`).

> **Never rename or drop an exported function; renaming deletes it on deploy.**
> The deployed function with the old name is removed and clients that still call it break.

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

Paul only, as a manual step, in the order described in [`docs/security-rollout.md`](../docs/security-rollout.md). Agents never deploy.
