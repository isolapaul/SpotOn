# Apple App Store: the path for SpotOn

SpotOn is a PWA. Google Play ships it as a Trusted Web Activity (`docs/deploy.md` §17, `docs/play-store.md`). The App Store has no equivalent: an iOS app needs a native shell (Capacitor is the closest fit) and has to pass guideline 4.2 (more than a wrapped website). This page lists what is already in the repository and what the owner has to decide or do.

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

## Owner steps before an iOS build

1. Apple Developer Program membership.
2. Sign in with Apple: a Services ID and key in the Apple developer account, the Apple provider enabled in Firebase Auth (with the return URL Firebase shows), then build with `NEXT_PUBLIC_APPLE_SIGN_IN=1` (a GitHub repository variable for releases).
3. Decide on the shell (decision needed, not started): Capacitor with the built app bundled, or loading the live site. A shell that only loads the site risks a 4.2 rejection.

## Work the shell needs (not started; each its own branch)

- **Sign-in inside the shell:** Google refuses OAuth in an embedded web view (`disallowed_useragent`). Use native sign-in (for example `@capacitor-firebase/authentication`) for Google and Apple, then `signInWithCredential` in the web layer.
- **Push:** web push does not run in WKWebView. Native push (APNs key uploaded to Firebase Cloud Messaging, a native token registered next to the FID in `usePushNotifications`).
- **Tour install step:** inside the shell the "Add to Home Screen" step must not show (`lib/onboarding.ts` `isStandaloneLaunch`; check `Capacitor.isNativePlatform()`).
- **Info.plist purpose strings:** location when in use (the map and "Near me"), photo library and camera (spot photos, profile pictures); `PrivacyInfo.xcprivacy` (UserDefaults; no tracking domains).
- **App Privacy answers:** e-mail, name (Google/Apple sign-in), user ID, photos, other user content, coarse/precise location (not stored), device ID (push token); none used for tracking.
- **Age rating:** user-generated content, unrestricted; 16+ as on Play.
- **Review notes:** a demo account, how to report and block, the 24-hour review promise.
