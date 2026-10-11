# Growth plan (owner-approved 2026-10-11)

The work agreed after the app-store round, in build order. Each step is its own commit with its
gates (`verify`, `verify:fn`, `test:rules`, the e2e specs it touches) and a CHANGELOG entry.
Status: `[ ]` open, `[x]` done.

## Shared foundation
- [x] **`config/app` doc** (public read, edited in the Firebase console): `minVersion {ios, android}`,
  `lockEnabled`, `launchChallengeEnd`. One listener in the client (`useAppConfigStore`).
- [x] **Minimum version gate** (apps only): when the bundled build is older than `minVersion`,
  a full-screen "Update SpotOn" with the store link. The bundled apps cannot follow server-side
  changes by themselves, so this is the way to retire an old build. The web is always current.

## 1. Error reporting and analytics (no third party, no consent banner)
- [x] **Client errors**: `window.onerror`, `unhandledrejection` and the error boundaries send a
  short report (message, top of the stack, version, platform, path) to the `reportClientError`
  callable. Stored deduplicated in `clientErrors/{hash}` with a count and first/last seen;
  rate-limited; no user id, no free text from users. The super admin sees them in the admin tools.
- [x] **Analytics**: anonymous daily counters only (`stats/{yyyy-mm-dd}`: app opens by platform,
  sign-ups, first spots, spots submitted, invites claimed, shares, share cards, visits, challenge
  completions). The `logEvent` callable accepts a fixed list of event names and increments a
  counter; nothing identifies a person, so no consent banner is needed (the privacy policy names
  it). The super admin sees the last 30 days as a funnel.

## 2. Referral program
- [x] **Code = username.** Personal link `https://spoton.isolapaul.hu/i/<username>`; opening it
  stores the inviter on the device and opens the app (App Links / Universal Links cover `/i/`).
- [x] **"Who invited you?"** after sign-up or an opened invite link (prefilled, editable,
  skippable), and on the invite sheet for 7 days after sign-up. The `claimReferral` callable: once per account, not yourself,
  the inviter must exist and not be blocked either way, account younger than 7 days; writes
  `referrals/{inviteeUid}` (`referrer`, `createdAt`, `spotApproved`) — server-only.
- [x] **Rewards (XP, no money)**: invitee +10 XP when claiming; inviter +10 XP per invitee, and
  +20 more when the invitee's first spot is approved (set by `approveSpot` / the spot trigger).
  Referral XP joins the XP sum in `syncUserLevel` (one query on `referrals`).
- [x] **Badges at 3, 5 and 10 invitees** (new design: bronze, silver, gold "Ambassador"),
  shown on the profile; `publicProfiles.invites` mirrors the count. Steps 1-3-5-10 show as a
  progress row on the invite screen (1 = first friend, XP only).
- [x] The inviter gets an inbox notice and a push ("X joined with your invite"), follows setting.
- [x] Invite screen: the link, copy, share, the progress row, the friends who joined.

## 3. Views and popularity
- [x] `recordSpotView` callable: one counted view per person, spot and day (server marks), the
  owner's own views do not count; `spots.viewCount`. Called once when the details open.
- [x] Shown quietly: a small eye count on the details stats row, nothing else.
- [x] **Popularity** = views + 5·likes + 10·reviews + 10·visits (`lib/popularity`): an Explore
  sort "Popular" and the unlocked set of the locked pins (below).
- [x] The weekly digest also tells creators how many times their spots were viewed that week
  (`ownerStats/{uid}`, one week at a time).

## 4. "I was here"
- [x] A button on the spot details; the `markVisited` callable checks that the reported position
  is within 300 m of the spot, one per person and spot.
  `users/{uid}/visits/{spotId}` (owner read), `spots.visitCount`.
- [x] Profile: a "Visited" count and a stamp grid of the visited spots.

## 5. Locked pins (give-to-get)
- [ ] Every pin stays on the map. A locked pin's card shows a blurred photo, the category and the
  distance, but not the name, description or details, with "Add your first spot to unlock every
  place" (and on the web and Android also "or invite a friend").
- [ ] Unlocked for everyone: the 30 most popular spots, own spots, spots of people you follow,
  spots opened from a link. Everything unlocks with one submitted spot or one claimed invite.
- [ ] Switched by `config/app.lockEnabled` (off by default until a city has enough spots).
- [ ] Apple: the iOS app shows only the "add a spot" unlock (guideline 3.2.2: no unlocking through
  inviting others). The lock is a nudge, not protection: approved spots stay publicly readable.

## 6. Share cards
- [ ] A clean 1080×1920 story card drawn on a canvas: the spot photo, name, category, rating and
  the link; shared as an image (Web Share with files, the native share sheet in the apps through
  a temporary file), else downloaded.

## 7. Public lists
- [ ] Shared lists get a public page `/list/<uid>/<listId>` (server-rendered, SEO title and
  description, the spots with photos, "Open in SpotOn"), listed in `/sitemap.xml` with the spots.
- [ ] Rules: a shared list is readable by anyone; lists store `nameLower` for search.
- [ ] Explore: "Lists" search over public lists.

## 8. Launch challenge (season "Launch", until 2027-06-30)
- [ ] Five easy steps: add a spot, write a review, follow someone, mark a visit, invite a friend
  (iOS: share a spot instead). Progress on a card in Explore and the profile.
- [ ] Completing all five: the "Founder" badge (only during the launch season) and +50 XP; the
  `claimChallengeBadge` callable checks every step on the server.

## 9. Native in-app review
- [ ] After the user's spot is approved (the inbox notice arrives), the app asks for a store
  rating through the native prompt (iOS StoreKit, Android Play In-App Review), at most once in 120
  days; the system decides whether it shows.

## Owner steps after the code
- Deploy order: indexes → functions → rules (`docs/deploy.md` §16); create `config/app`.
- Privacy policy: the anonymous counters and error reports; Data safety / App Privacy answers.
- A new app build (version gate, review prompt, invite links).
