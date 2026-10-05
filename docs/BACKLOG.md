# SpotOn backlog

Open work, as of v2.0.2 (2026-09-30). Nothing here is started. Each item becomes its own branch and PR when it is picked up, and the owner decides the open questions first.

## Product

| Item | Notes |
|---|---|
| Google Play release | Trusted Web Activity; the repository side is ready (`docs/deploy.md` §17, `docs/play-store.md`). Left: the developer account, the Bubblewrap build, the closed test and the listing. |
| Legal pages in English and German | `/privacy` and `/terms` are Hungarian only; English and German users get the Hungarian text. |
| Accessible labels in all languages | aria-labels and alt texts are English, because the e2e selectors depend on them. |
| "Special icons" level perk | Level 4 and 5 advertise "Use special icons" (`useCustomIcons`, `perkIcons`), but no such feature exists. Build it or drop the perk text. |
| Owners deleting their own spots | Only admins can delete a spot. Owners ask by e-mail (the privacy policy says so). |
| First-run tour copy to confirm | Check the install menu names on real iPhones and Android phones in hu/en/de (`onboardingInstall*`), whether "gyors ellenőrzés" (quick check) fits the real approval times, and whether "Új külsőben a SpotOn" (returning users) should become the neutral "Mi újság a SpotOnon?". |
| Inline links and the 44 px rule | The global minimum touch size also applies to links inside sentences (`LegalNotice` in the sign-in sheet, the tour's sign-up step, TermsPrompt), which spreads the lines apart. Decide whether inline text links get `no-min-size`. |

## Code health

| Item | Notes |
|---|---|
| Files over ~300 lines | `AuthModal.tsx`, `SettingsPanel.tsx`, `MapView.tsx` (the Mapbox hooks could move to `hooks/`) and `functions/src/callables/follows.ts` break the size convention in `CLAUDE.md`. |
| Held-back dev tooling | Checked 2026-10-02; nothing in the app or functions code uses a deprecated API (typed `@typescript-eslint/no-deprecated` scan). Held back because no compatible release exists yet: ESLint 9 in the root (`eslint-config-next` 16 bundles `eslint-plugin-react`, which supports up to ESLint 9), TypeScript 6 (typescript-eslint supports <6.1; TypeScript 7 is the native compiler). `npm audit` (dev only, not in the image; `npm audit --omit=dev` is clean): `basic-ftp` and `@opentelemetry/core` via `firebase-tools`, fixed only in majors of its dependencies. The `@grpc/grpc-js` advisory under the Firebase client is fixed by an override in package.json. |
| Orphaned Storage files | Removing a spot, rejecting a photo and an approved photo removal delete their files (item 4). Photos an admin deletes directly in the image manager still leave their files. |
| Reports about a deleted account | `deleteAccount` removes the reports the user filed, but reports about the user keep the reported text (`preview`) until an admin resolves them. Decide whether to delete or anonymise them at deletion (privacy policy). |
| Review appends | The rules let a signed-in user append any number of reviews to an approved spot, their own included (no XP, but the average rating and the owner's notifications). One review per user and spot, server-checked, would need a callable. |
| Legacy push tokens | `functions/src/lib/notify.ts` still sends to `users.fcmTokens` (the deprecated token API) for devices that have not opened v2.1.0 yet; each device drops its token when it registers its FID. Remove the fallback once the logs show `legacyTokens: 0` for a while, then the field (rules, CLAUDE.md data model). |
| Legacy user fields | `questProgress` / `questRewards` from the 2026 Valentine event are still on some `users` docs; nothing reads them. |
| T23 characterisation oracles | `src/lib/__oracles__/legacy.ts` pins the pre-refactor behaviour for a few helpers. They could be replaced by plain unit tests. |

## Operations

| Item | Notes |
|---|---|
| Automated Firebase deploys | Functions, rules and indexes deployed from GitHub Actions with approvals, keeping the order in `docs/deploy.md` §16. Needs a deploy credential (Workload Identity Federation). |
| Monitoring | Uptime check on `/api/health`, Cloud Functions error alerts, a Firestore usage/cost view. |
| Leaving Vercel | Stage A banner, Stage B redirect about 30 days later, then delete the project and its code (`docs/deploy.md` §15). |
| Dependabot for the compose file | Optional; needs a `DEPENDABOT_GHCR_TOKEN` (`docs/deploy.md` §3). |
| GHCR token expiry | The server's `read:packages` PAT expires a year after it was created; renew it a week before. |

## Operator duties (from the privacy policy and terms)

- Delete feedback e-mails, database exports and server logs after at most 1 year.
- Announce material changes to the terms or the privacy policy at least 15 days ahead in the app and by e-mail, and bump `TERMS_VERSION` (`src/lib/terms.ts`) so everyone accepts again.
- Keep a simple record of processing (GDPR Art. 30) and a breach log (Art. 33(5)); write short balancing tests for the legitimate-interest purposes (feedback, logs, retained spots, map tiles).
- Check whether Cloudflare sets cookies on the hostname.
- Photo uploads (spot photos, profile picture and banner, feedback attachments) are re-encoded through a canvas and carry no EXIF, including GPS location (`e2e/exif.spec.ts`). The privacy policy may say so.

## Accepted trade-offs (kept for reference)

- Feedback needs at least one character of text; image-only feedback is refused.
- On the old Vercel domain the tour's install step and the notification prompt are off while the move banner exists; dismissing the banner is permanent per device.
- GHCR pulls use a classic PAT with only `read:packages` (fine-grained tokens are not supported by the registry).
- Legacy or non-allowlisted custom name colours fall back to the level colour.
- A pending spot that someone else favourited disappears from their favourites until it is approved.
- The release job uploads the image and SBOM as a workflow artifact that any signed-in GitHub user can download for 1 day (public code and public config only).
- `publicProfiles` and `usernames` allow public `get` only, never `list`, so usernames and admins cannot be enumerated. The people search (item 8) is the one controlled exception: signed in only, a username prefix of 2+ characters, 10 results, 20 searches a minute per user, so enumerating everyone is slow and visible in the logs.
- The level count includes pending spots.
