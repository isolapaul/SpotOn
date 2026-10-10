# Changelog

Versions are the git tags that were released to the server (`vX.Y.Z`, see `docs/deploy.md`).
Releases before the move to the container ran on Vercel and were not tagged; they are listed by date.

## Unreleased

### Added (feed)
- A feed of the people you follow: the newest spots they shared, each with who shared it, when, the photos (swipe through them), the description and the rating. Below them come earlier spots from the community, so the feed is never empty, with a "People to follow" row.
- Tap a spot's name or "Show on map" in the feed: the feed slides away, the map flies to the spot and its place card opens with a "Feed" button that takes you back to the same place in the feed.
- From a feed card you can like the photo (or double-tap it), read and write reviews, share the spot and add it to your favourites; tap the poster to open their profile.
- The feed button in the bottom bar lights up when people you follow shared something new since your last visit; new posts arriving while you scroll show a "new spots" button.

### Added (people)
- Tap the followers or following count on a profile (yours or anyone's you can see) to see who follows them and whom they follow, with a name filter and a Follow button.
- When someone follows you, you get a notification in the app and a push (at most once a day per person; it follows the "Follows" notification setting).
- A notice that arrives while the app is open drops in at the top for a few seconds; tapping it, or the notice in the notification centre, opens that person's profile or flies to the spot.
- Tapping a push opens what it is about: a new follower's or follow request's profile, or the spot (profile links: `/user/<id>`).

### Fixed
- A shared spot link with a broken escape (`/spot/%E0%A4%A`) no longer breaks the page.

### Added (sounds)
- Short, quiet sounds when your spot or photos are uploaded, a notification arrives, you like a photo, add a favourite, follow someone or level up. They can be turned off in Settings → Sounds; the iPhone's silent switch mutes them.

## v2.1.0 — 2026-10-03

### Added
- A public page for deleting your account without the app (`/account-deletion`): what is deleted and what stays, how to do it in the app, and sign-in and deletion right on the page.
- Preparation for the Android app on Google Play: an adaptive (maskable) app icon, screenshots in the web manifest, and the Android app link file.
- A first-run tour on a demo map: discovering spots and Explore, sharing your own spot, XP, levels and the community, then location, adding SpotOn to the home screen and signing up. Pick your username on the way (it is reserved when you sign up). Everyone sees it once per device, signed-in users a shorter version; it replaces the full-screen install screen. Shared spot links open the spot first.

### Added (navigation)
- Tap a spot in your profile (My Spots, Favorites, and Pending for admins): the profile slides away, the map flies to the spot and its place card opens, with a "Profile" button that takes you back. Swiping the card down leaves you on the map at the spot.
- A spot opened from Explore goes back to Explore when you close it, with the same order, category and scroll position.
- The Android back gesture and the browser's Back button step back inside the app (spot to profile or Explore, a panel to the map) instead of leaving it.

### Added (moderation)
- Admins can reject a pending spot or delete a spot, always with a reason. The owner gets a push and a note in the notification centre that stays; a rejected spot shows the reason in My Spots and on the spot, and can be edited and resubmitted for review.
- Changes to an approved spot (name, description, category, location, photos) wait for an admin's approval; the spot stays as it is meanwhile. The owner sees that the changes are under review and can withdraw them.
- Photos other people add to a spot show after an admin approves them.
- The admin review has three lists: new spots, changes (shown as old and new) and photos.
- The owner can change a spot's category and location while editing it; a rejected spot has a grey pin with a cross (only its owner and admins see it).
- The notification centre also shows decisions about your spots and photos, on every device.

### Added (levels)
- Levels come from XP: an approved spot is worth 10 XP, an approved photo 3 XP and a review of someone else's approved spot 2 XP (once per spot). Levels start at 30, 100, 150 and 200 XP. If something is deleted its XP goes too, but nobody drops below the level they had before.
- The profile shows your XP and how much you need for the next level; the level info explains how to earn XP.

### Added (pin style)
- From level 4 you can pick one of eight icons (star, crown, flame, mountain, leaf, bolt, diamond, moon) for the map pins of all your spots, in My Spots.

### Added (categories)
- The super admin can add categories (Hungarian name, optional English and German names that fall back to Hungarian) with one of sixteen hand-drawn icons, rename them, change their icon and delete one no spot uses. They show up for everyone when adding or editing a spot, in Explore and on the map pins.

### Added (profiles)
- Every user has a profile page: tap a spot's creator, a reviewer or a search result. It shows the picture, name, level, bio, the number of spots, followers and following, and their approved spots.
- Follow anyone with a public profile. A private profile shows its spots only to followers it accepts; follow requests appear at the top of the notification centre. You can cancel a request and remove a follower. Your spots always stay on the map.
- A bio of up to 150 characters, a private profile switch and an option to show your saved spots on your profile (Settings → Privacy).
- Search in Explore: spots by name, and people by username.
- Notifications for follow requests, accepted requests and new spots from people you follow (with their own switch).

### Added (safety)
- Report a spot, a photo, a review or a profile with a reason; admins see reports in a fourth review tab and dismiss them or remove the content with a reason the author receives.
- Block a user from their profile: follows end both ways, you no longer see each other's profiles or appear in each other's search, and their reviews are hidden for you. Unblock in Settings → Privacy.

### Added (sharing and map)
- Every approved spot has a link (spoton.isolapaul.hu/spot/…) with a preview (photo, name, rating) in chat apps. Opening it flies the map to the spot and opens its card. Share from the place card or the details (the phone's share sheet, else the link is copied).
- Zoomed out, nearby pins merge into a green circle with the count (a clock when a spot under review is inside); a tap zooms in until it splits. Highlighted pins never merge.

### Added (reviews)
- Edit or delete your own review (deleting removes its replies too).
- Reply under any review, also to ask a question; the review's author and the spot's owner are notified. Replies can be edited, deleted and reported.

### Added (lists and Explore)
- Your own spot lists ("Sunsets", "For the weekend"): save a spot to one or more lists from its details, open them in Favorites, remove spots or delete a list. A list can be shown on your profile (a private profile shows it only to followers).
- Explore's "New this week" chip shows only spots approved in the last 7 days, with their number; it combines with the category filter.

### Fixed (review pass)
- An admin approves the version of a spot they saw: if the owner changed it meanwhile, the app asks to check it again.
- A user with 5 photos waiting on a spot sees that message (not "the spot is full"), and retrying a photo that is already waiting no longer fails.
- XP: new accounts start from level 1 (creating many spots at once no longer gives a permanent level), and only photos a spot shows count.
- Replies go through the server: only under existing reviews, not from someone the review's author blocked, at most 30 an hour. Reports are limited to 20 an hour and follows to 60 an hour; admins hear about an edit proposal at most once an hour per spot.
- A review from a user the owner blocked no longer notifies them. Removing a profile through a report also removes its picture, banner and username.
- Deleting an account also removes the replies to the user's reviews and the notices naming them in other people's notification centres; follows can no longer reappear for a deleted account.
- Removing a spot takes it out of everyone's lists. Reports about content its author already deleted can be resolved.
- The map: a device without WebGL gets a note instead of a blank app, the map stays flat (no globe), flying to a spot reports arrival at the right time, a rejected Mapbox token falls back to the theme background, and Mapbox performance telemetry is off.
- Share-link previews use the right photo, and odd links no longer give a server error.
- Photos submitted for review are limited to 20 an hour per user (each one notifies the admins). A photo earns XP once, for the person who uploaded it. Admins can approve older spots that were saved without a creation time.

### Changed (platform)
- Push notifications use Firebase Installation IDs (the token API is deprecated); a device moves over the next time the app opens, and keeps getting notifications on its old registration until then. The service worker runs on the modular Firebase SDK.
- Node.js 24 LTS for the app image, the build and Cloud Functions; dependencies on their latest releases.
- Tailwind CSS 4 (the screens are pixel-identical to before).

### Changed (legal)
- The Privacy Policy and the Terms of Use describe the new features (bio, follows, private profiles, search, XP levels, moderation with reasons, the map provider) and say that removals are announced in the app with the reason. Everyone is asked to accept the new version once.
- Both documents are also available in English (/privacy/en, /terms/en); the English and German app link there. The Hungarian version is authoritative.

### Changed (map)
- The map runs on Mapbox GL JS: sharper vector maps on every screen, smooth zooming, the same five styles (Standard, Light, Silver, Dark, Satellite), the same pins, place card, fly-to and picking. Rotation and tilt stay off, as before.

### Changed
- The browser and system bars use the app's dark background colour.
- Calmer spot details: under the name one line with the category and the rating, then a wide Directions button, the favourite heart and a "More" button. Save to list, Share and (for your own spots) Highlight are in the More sheet; a signed-out visitor gets a Share button directly.
- Lighter profile figures: spots, followers and following as one row of large numbers without boxes, right under the name and bio, on your own profile and on other people's. The number of favourites left the row (the Favorites tab shows them).
- Your level is shown once, on the level card (name, level, XP and progress); tap the card for the level info.

## v2.0.2 — 2026-09-29

### Fixed
- The Light, Dark and Silver map styles no longer show CARTO's "API KEY REQUIRED" watermark: the tiles are requested with the app's CARTO key (`NEXT_PUBLIC_CARTO_API_KEY`, a build-time variable).
- The Standard and Satellite maps are sharp on phones: on high-density screens they load the next zoom level at half size instead of stretching the tiles.

## v2.0.1 — 2026-09-29

Tagged by mistake on the v2.0.0 commit; the same code as v2.0.0. Skipped.

## v2.0.0 — 2026-09-29

### Added (legal, account)
- Privacy policy (`/privacy`) and terms of use (`/terms`), in Hungarian, readable without installing the app and linked from Settings and the sign-in sheet.
- Signing in or signing up accepts the terms (the sign-in sheet says so and links both documents); the accepted version and time are recorded. Users who signed up earlier are asked once to accept or sign out.
- Delete your account in Settings: your profile, username, reviews, likes, highlights, profile pictures and photos on other people's spots are removed. Your own spots stay on the map without your name, photo or account id, and their photos move out of your folder.

### Fixed (design 1A)
- The installed iPhone app now fills the whole screen: the map runs under the status bar and down to the bottom edge, with no band below it (a workaround for an iOS 26 bug). The page background follows the map style instead of black.

### Changed (profile, settings, spot details)
- The profile scrolls as one page (a pull down from the top closes it), with a calmer banner, a larger avatar, figures in tiles, the sections as a segmented control and cleaner spot cards.
- Settings drop the purple gradients and the flag emoji: grouped cards in the app colours, languages as a list with a check mark.
- A spot whose main photo does not load shows its other photos, or its category icon, instead of a broken image.
- Spot details, Apple Maps style: the page scrolls as one (a title bar fades in once the photo has scrolled away), the category sits as a chip above the title, an action row under it (Directions, Save, Highlight for your own spot, Share), and location, date and uploader in one grouped card. The duplicate Directions button at the bottom is gone.
- Sign-in, add-spot and username sheets are calm dark cards with the app colours; the "or" divider no longer sits in a stray box. The loading screen shows the app's heart-pin mark, springing in and breathing gently instead of bouncing dots.
- Adding a spot: the category is picked from a grid of icon tiles instead of a plain drop-down.
- One look everywhere: the remaining blue and purple accents, gradients and glass boxes follow the app green and the calm dark surfaces (add-spot form, username setup, feedback, notification settings and prompt, install screen, admin tools, reviews). The upload status is a small capsule at the top, clear of the map controls.
- The map controls and the main menu are frosted and see-through instead of solid white, so they blend with the map.
- Pulling a panel down, the dimmed map behind it now brightens in step with the pull (no more separate grey layer).
- More small animations: pins land one after another with a little spring, the place card's lines glide in, the locate button spins when tapped.
- Spots whose photo lives only in the old single-image field now show it in the details and on the place card too.

### Changed (Explore)
- Explore is redesigned: a large title with the spot count, an iOS-style segmented sort (nearest / best rated), always-visible category chips with icons, the top spot as a big photo card, and a clean grouped list with category, distance and rating; rows glide in.

### Changed (transitions)
- Explore, Profile and spot details open as sheets sliding up and close sliding down; from a place card, Details grows the card's photo into the spot's header image. Follows the reduced-motion setting.
- Panels close by pulling them down from the top of their content (a quarter of the screen, or a quick flick); the sideways swipe that showed a black page behind is gone. Pulling the place card up, or tapping its grabber, opens the spot. The map controls no longer show on top of the sign-in sheet.

### Changed (copy)
- No more emoji in the interface text; icons (category glyphs, lucide) take their place where they carried meaning.

### Changed (levels)
- Levels have a new look and new names: Rookie, Explorer, Trailblazer, Local Legend, Cartographer (hu: Újonc, Felfedező, Ösvényjáró, Helyi legenda, Térképész). Each level has its own colour and a hand-drawn badge instead of an emoji; thresholds and perks are unchanged.
- Your avatar in the main menu wears a ring in your level's colour that fills toward the next level and pings when you add a spot.
- Reaching a new level plays a short celebration: the new badge springs in over confetti and shows what you unlocked.

### Changed (design 1C, 1E)
- New main menu: a capsule with Explore (and how many spots there are) and your avatar, plus a separate green + button. While you pick a place for a new spot, the capsule says "Tap the map to place" and the + turns into ×.
- The top-right corner holds one control stack: notifications, map style, feedback, and a new "my location" button that brings the map back to you. Map styles open as a small menu with mini map previews.
- Tapping a pin opens a place card from the bottom (photo, category, distance, rating, Directions / Details / favourite; approve for admins). Drag it down, tap the map or × to close; the pin grows while its card is open.

### Changed (design 1D)
- New map pins: one size at every zoom, the tip points at the exact spot, and hand-drawn category icons replace the emoji. Approved spots are green; pending ones are white with a dashed amber ring and a clock; highlighted ones get a gold ring and a star. Zoomed far out, pins become small dots. Your position is a calm iOS-style dot.
- Animations follow the system's reduced-motion setting everywhere.

### Fixed
- Every push notification arrived twice; now it arrives once.
- Your own pending spots now show on your map as yellow markers (only yours; other users' pending spots stay hidden).
- The review form is no longer shown on pending spots, where reviews are not accepted (BUG-29).
- Highlight refusals show a translated reason (not your spot, not approved yet, level too low, limit reached) instead of the server's English text (BUG-28).

### Changed
- The Valentine quest bonus no longer adds highlight slots; highlights come from your level only (SEC-22).
- My Spots in the profile is ordered newest first.
- New notification center: a clean sheet under the bell with one icon per type (no emoji), grouped into Today / Earlier, with subtle animations (respecting reduced motion).
- The push notification offer no longer pops up after sign-in: it appears once, after your first spot, review or photo, and never again on that device once answered (Settings keeps the switch).
- No language dialog on the first visit any more: the language follows the browser (Hungarian, English or German; Hungarian otherwise) and can be changed in Settings.
- Creating a spot, adding photos and sending a review now run in the background: the form closes at once and a small status pill under the top buttons shows the upload; the new spot appears on your map (yellow) once everything is uploaded. Closing the app during an upload cancels it.
- A review and photos can be sent together with one button; photos alone still work (no rating needed).
- A network step that gets no answer within 60 seconds fails with a clear message and a Retry button instead of hanging; a retry never duplicates a spot, photo or review.

## v1.0.0 — 2026-09-28

The first release of the container at https://spoton.isolapaul.hu, with the security hardening.

### Changed
- **New address: https://spoton.isolapaul.hu.** The old Vercel address shows one "SpotOn has moved" banner, later redirects permanently (308) and is then deleted. Users sign in once more on the new address and re-add it to the home screen (T19).
- Other users' names, photos, levels and admin badges come from server-maintained public profiles instead of their private user documents (T09, T11a).
- Usernames are claimed through a server transaction, so two users can no longer get the same name; new users get a generated name (T09, T11a).
- Image likes, adding photos to existing spots and highlights go through Cloud Functions; new spot photos are stored per user under `spot-images/{uid}/` (T10, T11b).
- Highlighting now requires your own approved spot; level 3+ users get their highlight slots server-side, and the old Valentine bonus still counts (T10).
- Spot counts for levels are kept by the server and include pending spots, so no one drops a level (T09).
- Feedback now needs at least one character of text; screenshot-only feedback is no longer accepted (T14).

### Security
- Firestore and Storage security rules are now in the repository and tested against the emulators; authorization no longer depends on the UI (T12).
- Review emails are no longer public: new reviews store no email or self-asserted badges, and a one-off script removes emails from existing reviews (T11b, T13).
- The feedback API has size, type and rate limits, verifies the sender's Firebase ID token when one is sent, and needs a configured recipient (T14).
- Strict Content-Security-Policy and security headers per environment, plus a Firebase auth proxy so sign-in runs on the app's own domain (T15).
- Admin rights come from `admins/{uid}` (super admin: `role: 'super'`); adding and removing admins is done by super-admin-only Cloud Functions, and no admin email is compiled into the app any more (T08, T11a).
- Next.js 16.3.6 and nodemailer 10.0.10 fix critical and high advisories (T05); Firebase JS SDK 12.19.0 clears the remaining high/critical audit findings (T06).
- Push tokens are pruned only when FCM reports them invalid, and signing out removes this device's token (T08, T11a).
- Security rollout runbook with backups, ordered steps and rollback for the rules and functions (T13).

### Infrastructure
- Hardened container image: Next.js standalone on distroless Debian 13, non-root, read-only files, health endpoint (T16).
- Server deployment with Docker Compose behind a Cloudflare Tunnel, pinned by digest, with an update script that verifies the image signature first (T17).
- Release pipeline on `v*` tags: Trivy gate, CycloneDX SBOM, cosign keyless signing, private GHCR, weekly re-scan (T18).
- ESLint 9, Vitest and the `verify` gate; Node 22 baseline (T01).
- CI workflow and Dependabot (T02).
- Firebase emulator harness with seeded legacy-shaped fixtures and Playwright end-to-end tests (T04).
- Cloud Functions on Node 22, firebase-admin 14, firebase-functions 7, TypeScript 5, ESLint 9 (T07).
- Removed dead client code, no visible change (T03).

### Fixes
- The loading screen could hang forever on start-up (T04).
- New-pending-spot alerts now also reach the super admin, the favourite notification has the right type, and an unknown language gets the English text (T08).
- Concurrent image likes and photo additions no longer overwrite each other, opening an old spot no longer writes to the database, and expired highlights no longer count as active (T10, T11b).
- Custom name colour/font and notification settings survive a reload and a new sign-in (T11a).
- Missing default avatar and manifest screenshot references (T15).

## 2026-06-29 (Vercel, not tagged)

### Changed
- Switched from Google Maps to OpenStreetMap/Leaflet (CARTO and Esri satellite tiles).
- Removed the Valentine quest.
- Refactored the core stores and components.
- Removed the retro, purple and night map themes.

## 2026-02-19 (Vercel, not tagged)

### Features
- Satellite view on the map, bug fixes and small UI improvements.

## Initial release (Vercel, not tagged)

### Features
- **Map Exploration**: Interactive Google Maps integration with spot markers, clustering, and geolocation
- **User Profiles**: Google and email authentication, customizable profiles with avatars and banners
- **Spot Uploads with Compression**: Upload scenic locations with images automatically compressed via browser-image-compression
- **Admin System**: Role-based admin panel for spot approval, user management, and category control
- **Multi-language Support**: Full localization for Hungarian (HU), English (EN), and German (DE)
- **iOS-style UI**: Glassmorphism design, smooth animations, and native-feeling touch interactions
- **Discovery Panel**: Browse and filter spots by category, distance, and rating
- **Reviews & Ratings**: Community-driven spot ratings and review system
- **Favorites**: Save and manage favorite spots
- **Push Notifications**: Firebase Cloud Messaging integration for real-time updates
- **PWA Support**: Installable progressive web app with offline capabilities

### Security
- Content Security Policy headers configured for all routes
- X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy, and Strict-Transport-Security headers
- All API keys and secrets managed via environment variables
- No hardcoded credentials in source code

### Performance
- Touch-optimized mobile experience with manipulation touch-action
- Image compression for all uploads (spots and profile images)
- Dynamic imports and code splitting for map components
- Minimum 44px touch targets for accessibility
