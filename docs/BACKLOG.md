# SpotOn backlog

Open work, as of v2.0.2 (2026-09-30). Nothing here is started. Each item becomes its own branch and PR when it is picked up, and the owner decides the open questions first.

## Product

| Item | Notes |
|---|---|
| Google Play release | Needs a packaging choice (Trusted Web Activity or a native wrapper), a store listing, the Data safety form and a content rating. |
| Account deletion without the app | Google Play requires a web page or link where users can ask for deletion without installing the app. Today they can only e-mail the contact address from the privacy policy. |
| Legal pages in English and German | `/privacy` and `/terms` are Hungarian only; English and German users get the Hungarian text. |
| Accessible labels in all languages | aria-labels and alt texts are English, because the e2e selectors depend on them. |
| Category manager | The super admin can add categories to `categories/{id}`, but nothing reads them; the add-spot form uses the nine built-in categories. Finish the feature or remove it. |
| "Special icons" level perk | Level 4 and 5 advertise "Use special icons" (`useCustomIcons`, `perkIcons`), but no such feature exists. Build it or drop the perk text. |
| Owners deleting their own spots | Only admins can delete a spot. Owners ask by e-mail (the privacy policy says so). |

## Code health

| Item | Notes |
|---|---|
| Files over ~300 lines | `AuthModal.tsx`, `AddSpotModal.tsx` and `SettingsPanel.tsx` break the size convention in `CLAUDE.md`. |
| Deprecated dev tooling | Left because no update fixes them yet: ESLint 9 (`eslint-config-next` 16 bundles `eslint-plugin-react`, which crashes on ESLint 10), and transitive `glob@10`, `json-ptr` and `node-domexception` (from `firebase-tools` and `firebase-admin`; the latest versions still depend on them). `npm audit` reports 3 moderate advisories in `@opentelemetry/core` via `firebase-tools` (dev only, not in the image; `npm audit --omit=dev` is clean). |
| Orphaned Storage files | Files stay when an admin deletes a spot or a photo; only `deleteAccount` cleans up (its own user's folder). |
| Legacy user fields | `questProgress` / `questRewards` from the 2026 Valentine event are still on some `users` docs; nothing reads them. |
| T23 characterisation oracles | `src/lib/__oracles__/legacy.ts` pins the pre-refactor behaviour for a few helpers. They could be replaced by plain unit tests. |
| CARTO raster tiles | CARTO now needs an API key and is moving users to vector tiles; the Light/Dark/Silver styles may need a new source later. |

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
- On the old Vercel domain the install and notification prompts are off while the move banner exists; dismissing the banner is permanent per device.
- GHCR pulls use a classic PAT with only `read:packages` (fine-grained tokens are not supported by the registry).
- Legacy or non-allowlisted custom name colours fall back to the level colour.
- A pending spot that someone else favourited disappears from their favourites until it is approved.
- The release job uploads the image and SBOM as a workflow artifact that any signed-in GitHub user can download for 1 day (public code and public config only).
- `publicProfiles` and `usernames` allow public `get` only, never `list`, so usernames and admins cannot be enumerated.
- The level count includes pending spots.
