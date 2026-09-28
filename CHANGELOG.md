# Changelog

## v2.1.0 — 2026-09-26

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

## v2.0.0 — 2026-06-29

### Changed
- Switched from Google Maps to OpenStreetMap/Leaflet (CARTO and Esri satellite tiles).
- Removed the Valentine quest.
- Refactored the core stores and components.
- Removed the retro, purple and night map themes.

## v1.1.0 — 2026-02-19

### Features
- Satellite view on the map, bug fixes and small UI improvements.

## v1.0.0 - Initial Production Release

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
