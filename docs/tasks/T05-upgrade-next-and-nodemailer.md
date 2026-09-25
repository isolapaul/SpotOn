# T05 — Next 16.3.x and nodemailer 10

**Phase:** 1 · **Depends on:** T04 · **Risk:** low-med · **Decisions:** —
**Audit refs:** SEC-07 (`next` CRITICAL, `nodemailer` HIGH)

## Goal
Remove the directly vulnerable `next` 16.1.6 and `nodemailer` 8.0.1 by pinning `next@16.3.6` and `nodemailer@10.0.10`. Behaviour, headers, routes and the feedback email format stay identical. The remaining audit findings come only from `firebase@10`, and T06 fixes them.

## Context
- `package.json`: `"next": "^16.1.6"` (locked 16.1.6), `"nodemailer": "^8.0.1"`, `"@types/nodemailer": "^6.4.4"`. T01 already set `"eslint-config-next": "16.3.6"` and `"@types/node": "^22.20.4"`.
- Latest versions on 2026-09-25: `next` **16.3.6** (latest 16.x), `eslint-config-next` 16.3.6, `nodemailer` **10.0.10**.
- **nodemailer 10 ships its own TypeScript types** (`dist/esm/nodemailer.d.ts`; "migrate to TypeScript with ES module and CommonJS builds"). With it installed, `tsc` resolves `nodemailer` to the package's own declarations, not `@types/nodemailer` (verified with `--traceResolution`). `@types/nodemailer` (latest 8.0.2 describes the v8 API) is redundant and is removed. No `@types/nodemailer` exists for v10.
- `src/app/api/feedback/route.ts` uses only:
  - `import nodemailer from 'nodemailer'` (default import);
  - `nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } })`;
  - `transporter.sendMail({ from, to, subject: 'SpotOn_feedback', text, replyTo: senderEmail || undefined, attachments: [{ filename, content: Buffer, contentType }] })`;
  - `info.messageId`.
- Breaking changes between nodemailer 8.0.1 and 10.0.10, from the package `CHANGELOG.md`, and their relevance here:

  | Version | Breaking change | Affects `route.ts`? |
  |---|---|---|
  | 10.0.0 | Node.js ≥ 20 required; TypeScript rewrite with ESM + CJS builds and bundled types | No. Node 22; the default import still works (verified) |
  | 9.0.0 | HTTPS fetches of remote content (attachment `href`/`path` URLs, OAuth2 token endpoints, proxy CONNECT) now validate TLS certificates | No. Attachments are in-memory `Buffer`s; no OAuth2 or proxy |
  | 8.0.x (already on 8) | error code `NoAuth` renamed to `ENOAUTH` | No. The route does not inspect error codes |
  | 7.0.0 (already past) | SES transport changes | No. SMTP only |

  Verified: with `jsonTransport`, v10 accepts the exact `sendMail` shape above. `replyTo: undefined` yields no Reply-To. The subject and the attachment count are preserved.
- Next 16.1.6 → 16.3.6: `next build`, the CSP/`headers()` output, the `/api/feedback` and `/api/firebase-messaging-sw` routes, and T04's E2E all pass unchanged (verified in a scratch copy). `next lint` no longer exists; T01 already switched to `eslint .`.
- **Audit after this task (verified).** `npm audit --omit=dev` shows no entry for `next`, `nodemailer`, `sharp` or `postcss`. `--audit-level=high` **still exits non-zero**. Every remaining HIGH/CRITICAL item is transitive under `firebase@10.14.1`:
  - `protobufjs` (critical; via `@firebase/firestore` → `@grpc/proto-loader`);
  - `websocket-driver` (critical; via `@firebase/database` → `faye-websocket`);
  - `@grpc/grpc-js` (high);
  - `undici` (high).

  Moderate items: the `@firebase/*` packages and `baseline-browser-mapping`. T06 removes all the high and critical ones.

## Files
- Modify: `package.json`, `package-lock.json`
- Delete: — (the `@types/nodemailer` dev dependency is removed from `package.json`)

## Steps
1. `npm i --save-exact next@16.3.6 nodemailer@10.0.10`
2. `npm uninstall @types/nodemailer`
3. Make sure `package.json` has exactly `"next": "16.3.6"`, `"nodemailer": "10.0.10"` and `"eslint-config-next": "16.3.6"` (from T01; set it if not), and that `@types/node` is `^22.x`. Pin `nodemailer` exactly: CLAUDE.md §5 rule 10 (security-relevant) takes precedence over a caret range, and Dependabot (T02) keeps it current.
4. Do **not** edit `src/app/api/feedback/route.ts`, `next.config.mjs` or any other source file. If `tsc` or the build fails, stop and ask (see below).
5. Run the acceptance commands.

## Must NOT change
- `next.config.mjs` (headers, CSP, images), all routes, the SW route output, and the UI.
- The feedback email: SMTP env handling, `from`, `to`, `subject: 'SpotOn_feedback'`, text format, `replyTo`, attachments, and the HTTP status codes and JSON bodies. (Hardening is T14.)
- `firebase`, `react` and `react-dom` versions.

## Acceptance
```bash
# (export T01's demo NEXT_PUBLIC_FIREBASE_* values if no .env.local)
npm ci
node -p "const p=require('./package.json');[p.dependencies.next,p.dependencies.nodemailer,p.devDependencies['eslint-config-next'],p.devDependencies['@types/nodemailer']].join(' ')"
#   -> 16.3.6 10.0.10 16.3.6 undefined
npm ls next nodemailer eslint-config-next      # 16.3.6 / 10.0.10 / 16.3.6, no "invalid"
npm run verify                                 # green
npm run test:e2e                               # green
# nodemailer 10 accepts route.ts's exact call shape:
node --input-type=module -e "
import nodemailer from 'nodemailer';
const t = nodemailer.createTransport({ jsonTransport: true });
const i = await t.sendMail({ from: 'smtp@example.test', to: 'r@example.test', subject: 'SpotOn_feedback',
  text: 'Sender: anonymous \n\nMessage:\nhi', replyTo: undefined,
  attachments: [{ filename: 'image.jpg', content: Buffer.from('x'), contentType: 'image/jpeg' }] });
const m = JSON.parse(i.message); console.log(Boolean(i.messageId) && m.subject === 'SpotOn_feedback' && m.attachments.length === 1);"
#   -> true
# Feedback route still reports missing SMTP config exactly as before:
npx next start -p 3300 & sleep 5
curl -s -X POST localhost:3300/api/feedback -H 'content-type: application/json' -d '{"message":"x"}'
#   -> {"error":"SMTP not configured. Set SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS."}  (HTTP 500; run without SMTP_* env)
curl -sI localhost:3300/ | grep -i '^content-security-policy' | md5sum   # same hash as before the upgrade (take the "before" hash on the parent commit)
kill %1
# Audit: direct packages are clean; the remaining items are firebase@10 transitive (fixed by T06):
npm audit --omit=dev --json | node -e "const a=JSON.parse(require('fs').readFileSync(0));const v=a.vulnerabilities;console.log(['next','nodemailer','sharp','postcss'].filter(n=>v[n]).length, Object.keys(v).filter(k=>['high','critical'].includes(v[k].severity)).sort().join(','))"
#   -> 0 @grpc/grpc-js,protobufjs,undici,websocket-driver
npm audit --omit=dev --audit-level=high; echo "exit $?"   # non-zero until T06 (expected); record the output in the commit body
```

## Rollback
`git revert` the commit, then `npm ci`. There is no data impact. Production (Vercel) redeploys from git.

## Stop and ask Paul if…
- `tsc` reports type errors in `route.ts` with nodemailer's bundled types. Do not add `any` casts or change the call shape without approval.
- The high/critical audit list differs from the expected `@grpc/grpc-js, protobufjs, undici, websocket-driver`, especially if `next` or `nodemailer` still appears.
- A newer `16.3.x` or `10.0.x` has been published. Use the newest patch, and state it in the commit. Ask Paul only if its changelog lists a breaking change.
- The served CSP or other headers differ after the upgrade.
