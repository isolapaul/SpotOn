# T14 — Harden `/api/feedback`

**Phase:** 2 · **Depends on:** T05 (Next 16.3.x, nodemailer 10) · **Risk:** low · **Decisions:** D10
**Audit refs:** SEC-06, SEC-18 (fallback recipient)

## Goal
`/api/feedback` stops being an open mail relay. It caps the request body while streaming, validates the message and attachments strictly, rate-limits each IP, and takes the sender identity only from a verified Firebase ID token. Anonymous feedback stays allowed (D10). The email Paul receives keeps its subject and text format.

## Context
- `src/app/api/feedback/route.ts` (current state):
  - :3 hardcodes a fallback recipient email, which SEC-18 requires removing.
  - :15 calls `await req.json()` with no size limit.
  - :16 trusts the client-supplied `senderName` and `senderEmail`. The email is used as `replyTo` (:52).
  - :5-11 takes the MIME type from the client's data URL.
  - There is no limit on the number or size of attachments.
  - :26 returns an SMTP config hint to the client.
  - The mail is `subject: 'SpotOn_feedback'` (:50) with this text body (:45):
    `Sender: ${name||'anonymous'} ${email?'<email>':''}\n\nMessage:\n${message||'(empty message)'}`.
- `src/components/FeedbackPanel.tsx`:
  - :26 caps each **selection** at 6 files, but repeated selections accumulate without limit.
  - :50 compresses with `browser-image-compression` `{maxSizeMB:1, maxWidthOrHeight:1600}`. `useWebWorker` is left at the library default of `true`, and the library's worker then `importScripts()` its code from `https://cdn.jsdelivr.net/...`. That is blocked by the CSP (T15) and falls back to the main thread. Verified in `browser-image-compression@2.0.2` dist.
  - :60-65 sends `senderName`/`senderEmail` from the client.
  - :73 treats every non-OK response the same way: :80 `alert(t('feedbackSendError'))`.
  - :182 allows sending with files only and an empty message.
- The client uses `t()` from `useLanguageStore`. Existing feedback keys are in `src/lib/translations.ts` (hu :165-172, en :486-493). **de is missing 7 feedback keys; T22 adds them. Do not add them here.**
- Components must not import `firebase/*` (CLAUDE.md §6). Get the ID token through a store action.
- Trust boundary: in production the container is reachable only through the Cloudflare Tunnel, which sets `cf-connecting-ip`. On Vercel (during the T19 period) that header is absent, and `x-forwarded-for` is set by Vercel.
- Firebase ID tokens:
  - Algorithm RS256.
  - Keys come from the JWKS at `https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com`.
  - `iss = https://securetoken.google.com/<projectId>`, `aud = <projectId>`, and `sub` is the uid (non-empty).
  - Claims used: `name` (may be absent), `email`, `email_verified`.
  - Tokens from the **Auth emulator are unsigned** and will fail verification. That is intended.
- Library: `jose` (latest is 6.2.12, ESM, fine on Node 22). Pin it exactly.
- `nodemailer` is v10 after T05. Next App Router route handlers have no built-in body limit, so the handler must enforce one itself.

## Files
- Create:
  - `src/lib/feedback/validate.ts`: pure. Limits, payload parsing, magic bytes, filename sanitising.
  - `src/lib/feedback/validate.test.ts`
  - `src/lib/feedback/rateLimit.ts`: pure. Token bucket with an injected clock, plus `getClientIp(headers)`.
  - `src/lib/feedback/rateLimit.test.ts`
  - `src/lib/feedback/readLimitedBody.ts`: reads a `ReadableStream` up to N bytes.
  - `src/lib/feedback/readLimitedBody.test.ts`
  - `src/app/api/feedback/verifyIdToken.ts`: server-only. jose, with an injectable key set.
  - `src/app/api/feedback/verifyIdToken.test.ts`
  - `scripts/smtp-sink.mjs`: local test SMTP server.
  - `scripts/feedback-smoke.sh`: curl matrix.
- Modify:
  - `src/app/api/feedback/route.ts`
  - `src/components/FeedbackPanel.tsx`
  - `src/store/useUserStore.ts` (add `getIdToken` only)
  - `src/lib/translations.ts` (new keys only)
  - `package.json` / `package-lock.json` (`jose` dependency; `smtp-server` devDependency)
- (Place tests where T01's vitest `include` expects them. If T01 uses a `tests/` tree, mirror these names there.)

## Steps
1. **Dependencies.**
   - `npm i -E jose@6.2.12` (or the newest 6.x at implementation time, pinned exactly).
   - `npm i -D -E smtp-server@3.19.13`. It is by the nodemailer author and is used only by `scripts/smtp-sink.mjs`.
   - Justify both in the commit body.
2. **`src/lib/feedback/validate.ts`** (no Node-only APIs except `Buffer`; also importable by the client for the constants). Export:
   - `FEEDBACK_LIMITS = { maxAttachments: 3, maxAttachmentBytes: 1_500_000, maxMessageChars: 5000, maxFilenameChars: 80, maxBodyBytes: 6_300_000 }`.
     - `maxBodyBytes` covers 3 × base64(1.5 MB) = 6,000,000, plus the message and JSON overhead.
   - `detectImageType(buf: Uint8Array): 'jpeg'|'png'|'webp'|null`, by magic bytes:
     - JPEG `FF D8 FF`
     - PNG `89 50 4E 47 0D 0A 1A 0A`
     - WebP `52 49 46 46 ?? ?? ?? ?? 57 45 42 50`
   - `sanitizeFilename(raw: unknown, index: number, type): string`:
     - Take the basename (strip everything up to the last `/` or `\`) and drop the extension.
     - Replace every character outside `[A-Za-z0-9._-]` with `_`, collapse repeated `_`, and trim leading dots.
     - Cut to `maxFilenameChars`. If empty, use `feedback-${index+1}`.
     - Append the extension of the **detected** type (`.jpg`, `.png`, `.webp`).
   - `parseFeedbackPayload(json: unknown): { ok: true, value: { message: string, attachments: {filename, content: Buffer, contentType}[] } } | { ok: false, reason: 'invalid'|'too_large' }`:
     - `json` must be a plain object.
     - `message` must be a string. `message.trim()` has length 1..5000; keep the trimmed value.
     - `attachments` is optional; if present, an array of length ≤ 3.
     - Each item is `{ dataUrl: string, filename?: unknown }`. `dataUrl` must match `^data:[a-z0-9.+/-]{1,64};base64,([A-Za-z0-9+/]+={0,2})$`. The declared MIME is **ignored**.
     - Check the estimated decoded size (`len*3/4 - padding`) against the limit **before** decoding. Over the limit → `too_large`.
     - After decoding: bytes over the limit → `too_large`. `detectImageType` returns null → `invalid`.
     - `contentType` comes from the detected type (`image/jpeg|png|webp`).
     - Every other key (`senderName`, `senderEmail`, `mime`, …) is ignored.
3. **`src/lib/feedback/rateLimit.ts`.**
   - `createTokenBucket({ capacity: 5, refillIntervalMs: 120_000, maxKeys: 10_000, now = Date.now })` returns `take(key): { allowed: boolean, retryAfterSec: number }`.
     - This is 5 requests per 10 minutes, refilling continuously.
     - When `maxKeys` is exceeded, drop the keys whose buckets are full, then the oldest.
   - `getClientIp(h: Headers): string` returns, in order:
     1. `cf-connecting-ip` (trimmed), if non-empty;
     2. otherwise the first comma-separated hop of `x-forwarded-for`, trimmed;
     3. otherwise `'unknown'`.
   - Cap the key at 64 chars.
4. **`src/lib/feedback/readLimitedBody.ts`.**
   - `readLimitedBody(body: ReadableStream<Uint8Array>|null, max: number): Promise<{ ok: true, bytes: Uint8Array } | { ok: false }>`.
   - Read chunk by chunk. As soon as the running total exceeds `max`, call `reader.cancel()` and return `{ok:false}`.
   - A null body gives an empty result.
5. **`src/app/api/feedback/verifyIdToken.ts`.**
   - Module-level `const JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'))`.
   - `verifyIdToken(token, { projectId, keySet = JWKS })` calls `jwtVerify(token, keySet, { issuer: 'https://securetoken.google.com/'+projectId, audience: projectId, algorithms: ['RS256'] })`.
   - It returns `{ uid: sub, name?: string, email?: string, emailVerified: boolean }` and throws on failure.
   - Also reject an empty `sub`.
6. **Rewrite `src/app/api/feedback/route.ts`.**
   - Add `export const runtime = 'nodejs'` and `export const dynamic = 'force-dynamic'`.
   - Export only `POST`; Next answers 405 for other methods. The order of checks matters:
     1. `const bucket = take(getClientIp(req.headers))` (module-level bucket). If not allowed → **429** `{error:'rate_limited'}` with `Retry-After`.
     2. Read the config: `FEEDBACK_RECIPIENT`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`. If any is missing → **503** `{error:'unavailable'}`. Log `feedback: missing config` once, without values. **No fallback recipient.**
     3. `content-type` must start with `application/json`, else **415** `{error:'unsupported_media_type'}`.
     4. If a `content-length` header is present and > `maxBodyBytes` → **413** `{error:'payload_too_large'}` without reading the body.
     5. `readLimitedBody(req.body, maxBodyBytes)`. Over the limit → **413**.
     6. Parse JSON with `JSON.parse(new TextDecoder().decode(bytes))`. A throw → **400** `{error:'invalid_request'}`.
     7. `parseFeedbackPayload`: `too_large` → **413**; `invalid` → **400**.
     8. If an `Authorization` header exists, it must be `Bearer <token>`. Verify it with `projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID`.
        - Verification failure → **401** `{error:'unauthorized'}`.
        - A JWKS network error → **503**.
        - With no header, the sender is anonymous.
     9. Build the mail:
        - `from: SMTP_USER`, `to: FEEDBACK_RECIPIENT`, `subject: 'SpotOn_feedback'`, **text only** (no `html`).
        - `replyTo` is the token email **only if** `email_verified === true`.
        - Sender display name: `claims.name` if present, else `claims.email`, else `uid`. For no token: `'anonymous'`. Strip `\r` and `\n` from it.
        - Text: `` `Sender: ${displayName} ${email ? `<${email}>` : ''}\n\nMessage:\n${message}` ``. This keeps today's format exactly.
     10. Send with a lazily-created module-level transporter: `{ host, port, secure: port === 465, auth: {user, pass}, connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 20_000 }`. On failure → **502** `{error:'send_failed'}`.
     11. On success → **200** `{ok:true}`. Log `feedback sent` with `messageId` and the attachment count only. Never log the message, emails or tokens.
   - All responses use `Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })`.
   - Wrap the handler in `try/catch`; an unexpected error → **500** `{error:'server_error'}`, logged by `err.name` only.
7. **`useUserStore`.** Add `getIdToken: async () => auth.currentUser ? auth.currentUser.getIdToken() : null`, typed `() => Promise<string|null>`. Change nothing else in the store.
8. **`FeedbackPanel.tsx`.**
   - Import `FEEDBACK_LIMITS` from `@/lib/feedback/validate`.
   - `handleFiles`: `setFiles(prev => [...prev, ...Array.from(selected)].slice(0, FEEDBACK_LIMITS.maxAttachments))`.
   - Disable the "attach images" button when `files.length >= maxAttachments`.
   - `<input accept="image/jpeg,image/png,image/webp">`.
   - Below the thumbnails (or below the attach button when there are none), add one muted line: `text-white/50 text-xs mt-2` with `t('feedbackImageLimit')`.
   - Textarea: `maxLength={FEEDBACK_LIMITS.maxMessageChars}`. The send button is disabled when `sending || message.trim().length === 0`. This is an intentional change: image-only feedback is no longer possible, because the server requires 1..5000 characters.
   - Compression: `imageCompression(f, { maxSizeMB: 1, maxWidthOrHeight: 1600, useWebWorker: false })`. `useWebWorker: false` means no third-party CDN script is loaded, which keeps the CSP clean (T15). The output is identical; only the thread changes.
   - Payload: `{ message, attachments: [{ filename: f.name, dataUrl }] }`. **Remove** `senderName`, `senderEmail` and `mime`.
   - Headers: `Content-Type: application/json`, plus `Authorization: Bearer ${token}` when `await getIdToken()` returns a token.
   - Errors keep using `alert()`, with the message chosen by status:
     - 413 → `t('feedbackTooLarge')`
     - 429 → `t('feedbackRateLimited')`
     - anything else → `t('feedbackSendError')`
9. **Translations.** Add these keys to hu, en and de:

   | key | hu | en | de |
   |---|---|---|---|
   | `feedbackImageLimit` | Legfeljebb 3 kép (JPG, PNG, WebP) | Up to 3 images (JPG, PNG, WebP) | Bis zu 3 Bilder (JPG, PNG, WebP) |
   | `feedbackTooLarge` | A csatolt képek túl nagyok. Legfeljebb 3 kép, egyenként 1,5 MB. | The attached images are too large. Up to 3 images, 1.5 MB each. | Die angehängten Bilder sind zu groß. Höchstens 3 Bilder, je 1,5 MB. |
   | `feedbackRateLimited` | Túl sok üzenet rövid idő alatt. Próbáld újra néhány perc múlva. | Too many messages in a short time. Try again in a few minutes. | Zu viele Nachrichten in kurzer Zeit. Versuch es in ein paar Minuten noch einmal. |
10. **Unit tests (vitest, node environment).**
    - `validate.test.ts`:
      - Each magic-byte type is accepted.
      - A GIF, a text file labelled `image/png`, and an empty buffer are rejected.
      - Base64 with an illegal character is rejected.
      - 4 attachments → invalid.
      - An attachment one byte over the limit → too_large (use estimated size, and decoded size).
      - Message lengths `''`, `'   '` → invalid; `5000` → ok; `5001` → invalid.
      - A non-string message and a non-object root → invalid.
      - Filename cases: `../../etc/passwd.png` → `passwd.png`; `a b<>.jpeg` + png bytes → `a_b_.png`; an 81+ char name is cut; an empty name gives `feedback-1.jpg`.
      - `senderEmail` in the input is absent from the output.
    - `rateLimit.test.ts`:
      - 5 allowed, the 6th denied with `retryAfterSec` ≈ 120.
      - After 120 s on the fake clock, 1 more is allowed.
      - Keys are independent.
      - `getClientIp`: `cf-connecting-ip` wins; `x-forwarded-for: "1.1.1.1, 2.2.2.2"` → `1.1.1.1`; with neither → `'unknown'`.
      - Eviction happens at `maxKeys`.
    - `readLimitedBody.test.ts`: a stream of 3 chunks under the limit → ok with equal bytes; over the limit → `{ok:false}`, and the stream is cancelled; `null` → empty.
    - `verifyIdToken.test.ts`: generate an RS256 pair with `jose.generateKeyPair`, and use `createLocalJWKSet` as `keySet`. Check that:
      - a valid token is accepted and its claims are mapped;
      - a wrong `aud`, a wrong `iss`, an expired token, an `alg: none` / HS256 token, and an empty `sub` are all rejected.
11. **`scripts/smtp-sink.mjs`.**
    - Use `smtp-server`: `new SMTPServer({ authOptional: true, allowInsecureAuth: true, disabledCommands: ['STARTTLS'], onAuth: (a, s, cb) => cb(null, { user: 'test' }), onData })`.
    - Listen on `127.0.0.1:${SMTP_SINK_PORT||2525}`.
    - Append each raw message to `${SMTP_SINK_FILE||'/tmp/spoton-smtp-sink.eml'}`, followed by the separator line `----- END -----`.
    - This is a dev/test tool only, never imported by the app.
12. **`scripts/feedback-smoke.sh`** (bash, `set -euo pipefail`).
    - Takes `BASE=${BASE:-http://127.0.0.1:3000}` and `SINK=${SINK:-/tmp/spoton-smtp-sink.eml}`.
    - Each case uses a **unique** `cf-connecting-ip: 203.0.113.<n>`, so that cases don't share a bucket.
    - It asserts the status code of each case in the Acceptance table, and for the success cases greps the sink file.
    - Test data:
      - PNG: `public/icon-192x192.png` base64-encoded.
      - Oversized: 1,600,000 random bytes prefixed with PNG magic.
      - Large body: 7 MB, sent once with `Content-Length` and once with `-H 'Transfer-Encoding: chunked'` from a file via `--data-binary @file`.

## Must NOT change
- The endpoint path `POST /api/feedback`, the success response `{ok:true}` with status 200, and the email subject `SpotOn_feedback`.
- The mail text layout `Sender: … <…>\n\nMessage:\n…`. Only the source of the name and email changes (token instead of body).
- The FeedbackPanel look, layout, patch-notes preview and close behaviour, apart from the three intended changes: the 3-image cap with its hint line, send disabled for an empty message, and status-specific error texts.
- Anonymous (signed-out) feedback keeps working (D10).
- No other store actions or translation keys change.

## Acceptance
```bash
npm run verify
npx vitest run src/lib/feedback src/app/api/feedback

# Build with demo public config (no real values)
export NEXT_PUBLIC_FIREBASE_API_KEY=demo-key NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=localhost \
  NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-spoton NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=demo-spoton.appspot.com \
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=0 NEXT_PUBLIC_FIREBASE_APP_ID=1:0:web:0 NEXT_PUBLIC_FIREBASE_VAPID_KEY=demo
npm run build
rm -f /tmp/spoton-smtp-sink.eml; node scripts/smtp-sink.mjs & SINK_PID=$!
SMTP_HOST=127.0.0.1 SMTP_PORT=2525 SMTP_USER=test SMTP_PASS=test FEEDBACK_RECIPIENT=feedback@example.test \
  npx next start -p 3000 & APP_PID=$!
for i in $(seq 60); do curl -s -o /dev/null http://127.0.0.1:3000/ && break; sleep 1; done
bash scripts/feedback-smoke.sh
kill $APP_PID
# 503 case: restart without FEEDBACK_RECIPIENT
SMTP_HOST=127.0.0.1 SMTP_PORT=2525 SMTP_USER=test SMTP_PASS=test npx next start -p 3000 & APP_PID=$!; sleep 8
test "$(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'content-type: application/json' -H 'cf-connecting-ip: 203.0.113.99' \
  --data '{"message":"hi"}' http://127.0.0.1:3000/api/feedback)" = 503
kill $APP_PID $SINK_PID
grep -rn "isolapaul100\|@gmail.com" src/app/api/feedback && exit 1 || true   # no hardcoded recipient
```
`scripts/feedback-smoke.sh` must assert this matrix. All cases are POST, except the method case.

| # | Case | Expected |
|---|---|---|
| 1 | valid text-only, no auth | 200. The sink contains `Subject: SpotOn_feedback` and `Sender: anonymous`, and has no `Reply-To` |
| 2 | valid + 1 PNG + body `senderEmail: "evil@example.com"`, `senderName: "Admin"` | 200. The sink has a `.png` attachment, and **neither** `evil@example.com` **nor** `Admin` appears |
| 3 | `message: ""` / `"   "` / 5001 chars / missing | 400 |
| 4 | 4 attachments | 400 |
| 5 | text bytes as `data:image/png;base64,…` | 400 |
| 6 | 1.6 MB PNG-magic attachment | 413 |
| 7 | 7 MB body with Content-Length | 413 |
| 8 | 7 MB body chunked (no Content-Length) | 413 |
| 9 | `content-type: text/plain` | 415 |
| 10 | `Authorization: Bearer abc.def.ghi` | 401 |
| 11 | 6 requests from the same IP (use invalid bodies so that no mail is sent) | 5 × 400, then the 6th → 429 with a `Retry-After` header |
| 12 | `GET /api/feedback` | 405 |
| 13 | error bodies | match `^\{"error":"[a-z_]+"\}$`; no stack traces or config hints |

Manual check: in the running app (T04 emulator build, signed out), send feedback with 2 images and confirm the success path; select 5 images and confirm only 3 are kept and the button is disabled. With the de language, the new hint is German.

## Rollback
`git revert` the commit. The API is stateless, and the rate-limit state lives in memory only. No data or deploy implications, but reverting brings back SEC-06.

## Stop and ask Paul if…
- The T04 e2e smoke sends feedback **while signed in against the Auth emulator**. Emulator tokens are unsigned and will get 401. Do not add an emulator bypass to the verifier.
- A limit (3 images, 1.5 MB, 5000 chars, 5 per 10 min) turns out to reject real use. For example, compressed phone photos over 1.5 MB would need a client-side re-compress target change.
- Paul wants image-only feedback (an empty message) to stay possible.
