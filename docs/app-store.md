# Apple App Store: the path for SpotOn

The Android and iOS apps are their own builds: Capacitor projects that bundle a static export of the web app (`npm run build:app`; `capacitor.config.ts`, `mobile/`; runbook `docs/deploy.md` §17). This page is the App Store checklist: what is in place and what the owner does.

## Already in the app (both stores)

| Requirement | Where |
|---|---|
| In-app account deletion (5.1.1(v)); the public deletion page for Play | Settings → Account; `/account-deletion` |
| UGC (1.2): report, block, moderation, terms accepted at sign-up with zero tolerance for abuse, 24-hour review | `components/safety/*` (spots, photos, reviews, replies, profiles, feed cards), `TermsPrompt`, Terms §4–§5 |
| Privacy Policy and Terms reachable without signing in | Sign-in sheet; bottom of Explore (`LegalLinks`) |
| No tracking, no ads, no IDFA (no App Tracking Transparency prompt) | — |
| Offline page and error screens | `src/sw/firebase-messaging-sw.ts` (offline navigation), `src/app/error.tsx`, `not-found.tsx` |
| Sign in with Apple (4.8, required next to Google sign-in) | `signInWithApple` in `useUserStore`; the button shows with `NEXT_PUBLIC_APPLE_SIGN_IN=1` |
| Notification permission asked after a pre-prompt, never on launch | `NotificationPrompt` |

## Native in the iOS app

Native Google sign-in and Sign in with Apple (system sheets), native push (APNs through FCM) whose tap opens the profile, spot or feed it is about, Universal Links for spot, profile and feed links, the share sheet, haptics with the interface sounds, a Live Activity for running uploads (Dynamic Island and lock screen, iOS 16.2+; the `SpotOnWidgets` extension and the app's own `SpotOnNative` plugin), home-screen quick actions (Add a spot, Feed, Near me; long-press the icon), no "Add to Home Screen" step in the tour, `PrivacyInfo.xcprivacy`, and purpose strings for location, camera and photos.

## Owner steps

1. Apple Developer Program membership; the App ID `hu.isolapaul.spoton` with Push Notifications, Sign in with Apple and Associated Domains (automatic signing turns them on).
2. Firebase: the iOS app and the APNs key (`docs/deploy.md` §17.1); the Apple sign-in provider; then `NEXT_PUBLIC_APPLE_SIGN_IN=1` and a web release.
3. `APPLE_TEAM_ID` in the server's `.env` (Universal Links, §17.4).
4. App Store Connect: App Privacy (e-mail, name, user ID, photos, other user content, device ID for push; nothing for tracking), age rating with unrestricted user-generated content (16+ as on Play), a demo account and the moderation note (report, block, 24-hour review) in the review notes.
