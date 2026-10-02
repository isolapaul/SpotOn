# SpotOn Cloud Functions

Server-side logic for SpotOn: admin management, usernames and public profiles, XP levels and pin icons, categories, spot image likes and additions, spot highlights, moderation (rejections, removals, edit and photo review, the in-app inbox), reports and blocks, review edits and replies, follows and people search, account deletion and push notifications.
Together with the Firestore/Storage rules (`firestore.rules`, `storage.rules` in the repository root) these functions are the authorization boundary; UI checks are only for user experience.

## Runtime

- Firebase Functions v2 (`firebase-functions` 7), `firebase-admin` 14
- Node 24 LTS (`engines.node`; Cloud Functions supports it until 2028)
- Region `europe-west3` for every function (`setGlobalOptions` in `src/lib/app.ts`)
- `src/index.ts` only re-exports; the code lives in `src/triggers/`, `src/callables/` and `src/lib/` (shared helpers; the pure ones are unit-tested in `test/`)

## Exported functions

| Function | Trigger type | What it does | Who can call it |
|---|---|---|---|
| `onSpotUpdated` | Firestore trigger (`spots/{spotId}` updated) | One trigger for three events: pending → approved tells the creator (inbox + push) and their followers; rejected → pending (resubmitted) notifies all admins; a new review notifies the spot's creator (not for their own review, not from a user they blocked). Replaced `onSpotApproved`, `onSpotResubmitted` and `onReviewAdded` in v2.1.0 (the deploy asks to delete those three: answer yes) | Nobody (Firestore event) |
| `onSpotEditProposed` | Firestore trigger (`spotEdits/{spotId}` written) | Notifies all admins when an owner's edit proposal starts waiting for review, at most once an hour per spot | Nobody (Firestore event) |
| `onNewPendingSpot` | Firestore trigger (`spots/{spotId}` created) | Notifies all admins about a new pending spot; an admin's (approved) new spot tells their followers | Nobody (Firestore event) |
| `syncXp` | Firestore trigger (`spots/{spotId}` written) | Recomputes the XP and level of every user whose XP from the spot changed (`lib/xp.ts`, `lib/userLevel.ts`) and stamps the owner's pin icon on their spots | Nobody (Firestore event) |
| `onSpotFavorited` | Firestore trigger (`users/{userId}` updated) | Notifies a spot's creator when someone adds it to their favourites | Nobody (Firestore event) |
| `syncPublicProfile` | Firestore trigger (`users/{uid}` written) | Mirrors the public fields of a user into `publicProfiles/{uid}` | Nobody (Firestore event) |
| `syncSpotsCount` | Firestore trigger (`spots/{spotId}` written) | Recounts `spotsCount` (all statuses) on `users/{uid}` and `publicProfiles/{uid}` when a spot is created, deleted or changes owner | Nobody (Firestore event) |
| `syncAdminFlag` | Firestore trigger (`admins/{uid}` written) | Keeps `publicProfiles/{uid}.isAdmin` in line with `admins/{uid}` | Nobody (Firestore event) |
| `highlightSpot` | Callable | Highlights one of the caller's approved spots for 7 days, within the caller's level allowance | Signed-in users (own, approved spots) |
| `unhighlightSpot` | Callable | Removes the caller's highlight from a spot | Signed-in users |
| `toggleImageLike` | Callable | Likes or unlikes one image of a spot, in a transaction | Signed-in users |
| `addSpotImages` | Callable | Adds already uploaded images (the caller's own `spot-images/{uid}/…` objects) to a spot, up to 20 images. Admins and the owner of a spot under review add them directly; everyone else's become `photoSubmissions` for an admin (item 4), at most 5 waiting per user and spot | Signed-in users |
| `approveSpot` | Callable | Approves the version of a pending spot the admin saw (`seenAt`; refused with `SPOT_CHANGED` if the owner edited it since), stamps `approvedAt`; `onSpotUpdated` then tells the owner | Admins |
| `rejectSpot` | Callable | Rejects a pending spot with a reason (1–500 characters, stored on the spot for its owner) and tells the owner | Admins |
| `removeSpot` | Callable | Deletes a spot with a reason: its photo files, pending edit, photo submissions, replies, visits and reports go too, and its id leaves every list; tells the owner | Admins |
| `reviewSpotEdit` | Callable | Applies an owner's proposed edit of an approved spot (removed photo files are deleted), or rejects it with a reason; tells the owner. The admin names the reviewed version, so a changed proposal is never applied unseen | Admins |
| `reviewPhotoSubmission` | Callable | Adds a waiting photo to its spot, or rejects it with a reason (the file is deleted); tells the uploader | Admins |
| `reportContent` | Callable | Reports a spot, photo, review, reply or profile with a reason (once per person and thing, at most 20 an hour); tells the admins | Signed-in users |
| `resolveReport` | Callable | Dismisses the reports of a thing, or removes it with a reason (the author is told). For a profile, removal clears the bio, the profile picture and banner and frees the username. Content already deleted counts as resolved | Admins |
| `blockUser` / `unblockUser` | Callable | Blocks a user (ends follows and requests both ways) or lifts the block | Signed-in users |
| `editReview` / `deleteReview` | Callable | The author changes the rating and comment of their review, or deletes it with its replies and its reports | Signed-in users (own review) |
| `addReply` | Callable | A reply under a review of an approved spot: the review must exist, its author must not have blocked the replier; at most 30 an hour per user | Signed-in users |
| `onReplyCreated` | Firestore trigger (`spots/{id}/replies/{id}` created) | Tells the review's author and the spot's owner about a reply (not the replier, not someone who blocked them) | Nobody (Firestore event) |
| `claimUsername` | Callable | Claims a unique username through `usernames/{name}` in a transaction and frees the old one | Signed-in users (for themselves) |
| `updateNameStyle` | Callable | Sets the custom name colour/font from an allowlist | Signed-in users at level 5 |
| `updatePinIcon` | Callable | Sets the own special pin icon, stamped on all own spots (`ownerPin`) | Signed-in users from level 4 |
| `lookupUserByEmail` | Callable | Finds a user by email for the admin management screen | Super admin only |
| `addAdmin` | Callable | Creates `admins/{uid}` with `role: 'admin'` for a user found by email | Super admin only |
| `removeAdmin` | Callable | Deletes an `admins/{uid}` document (a super admin cannot be removed) | Super admin only |
| `deleteCategory` | Callable | Deletes a category only while no spot and no waiting edit uses it | Super admin only |
| `getProfile` | Callable | What a visitor may see of a profile: approved spot ids, saved spot ids if shared, the lists shown on the profile; private profiles only for accepted followers; the caller's follow state | Anyone |
| `followUser` | Callable | Follows a public profile, or sends a follow request to a private one (inbox + push, at most once a day per pair); at most 60 an hour | Signed-in users |
| `unfollowUser` | Callable | Unfollows, or cancels the caller's request | Signed-in users |
| `respondFollowRequest` | Callable | Accepts or declines a request to the caller (accept: inbox + push to the requester) | Signed-in users |
| `removeFollower` | Callable | Removes someone who follows the caller | Signed-in users |
| `searchUsers` | Callable | Username prefix search: 2+ characters, 10 results, 20 calls a minute per user | Signed-in users |
| `deleteAccount` | Callable | Deletes the caller's account: reviews (with the replies to them), photos on others' spots, likes, highlights, profile files, the inbox and lists, edit proposals and photo submissions, username, user doc, follows (counters adjusted), requests, blocks, filed reports, own replies, notices naming the user in others' inboxes, rate limits and the Auth user; own spots stay under the `deleted-user` placeholder owner, with their photos moved out of the user's folder | Signed-in users, not admins (the typed confirmation must match) |

The super admin is the `admins/{uid}` document with `role: 'super'`. It exists already; to recreate it (for example on a new project), promote an existing Auth user with
`npx tsx scripts/bootstrap-super-admin.ts --project <PROJECT_ID> --email <EMAIL>` (dry run; add `--apply` to write). The script uses Application Default Credentials.

> **Never rename or drop an exported callable; renaming deletes it on deploy.**
> The deployed function with the old name is removed and clients that still call it break. Triggers are not called by clients; replacing one (as `onSpotUpdated` did) only needs the deletion confirmed at deploy.

## Inbox

Moderation decisions, removals, follow news (requests, accepts, followed users' new spots) and replies reach the user twice: a push (each type follows its own notification setting, `settingsKeyOf` in `lib/inbox.ts`) and an item in `users/{uid}/inbox` (type, spot id and name, the reason, the other user for follow news and replies; at most 50 kept). The app shows the inbox in its notification centre, so a reason stays readable after the push and on every device.

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
