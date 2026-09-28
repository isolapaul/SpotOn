import nodemailer, { type Transporter } from 'nodemailer';
import { FEEDBACK_LIMITS, hasSmallJsonStructure, parseFeedbackPayload } from '@/lib/feedback/validate';
import { createTokenBucket, getClientIp } from '@/lib/feedback/rateLimit';
import { readLimitedBody } from '@/lib/feedback/readLimitedBody';
import { KeySetUnavailableError, verifyIdToken, type VerifiedIdToken } from './verifyIdToken';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_IN_FLIGHT = 2;
// 60 s: ~6 MB max body needs ~0.8 Mbit/s uplink (slow mobile); the in-flight cap (2) still bounds slow clients.
const BODY_READ_TIMEOUT_MS = 60_000;

// In-memory state (per server process): 5 per 10 min per IP (IPv6 per /64), ~20 per hour in total.
const perIpBucket = createTokenBucket({ capacity: 5, refillIntervalMs: 120_000, maxKeys: 10_000 });
const globalBucket = createTokenBucket({ capacity: 20, refillIntervalMs: 180_000 });
let inFlight = 0;
let missingConfigLogged = false;
let transporter: Transporter | null = null;

function reply(status: number, body: Record<string, unknown>, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}

const fail = (status: number, error: string, headers?: Record<string, string>) =>
  reply(status, { error }, headers);

type SmtpConfig = { recipient: string; host: string; port: number; user: string; pass: string };

function readConfig(): SmtpConfig | null {
  const recipient = process.env.FEEDBACK_RECIPIENT;
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const portValid = /^\d{1,5}$/.test(process.env.SMTP_PORT ?? '') && port >= 1 && port <= 65535;
  if (!recipient || !host || !portValid || !user || !pass) {
    return null;
  }
  return { recipient, host, port, user, pass };
}

function getTransporter({ host, port, user, pass }: SmtpConfig): Transporter {
  transporter ??= nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  return transporter;
}

async function handle(req: Request): Promise<Response> {
  // 1. Rate limits: per IP first; only an allowed request consumes a global token.
  const ipResult = perIpBucket.take(getClientIp(req.headers, process.env));
  if (!ipResult.allowed) {
    return fail(429, 'rate_limited', { 'Retry-After': String(ipResult.retryAfterSec) });
  }
  const globalResult = globalBucket.take('global');
  if (!globalResult.allowed) {
    return fail(429, 'rate_limited', { 'Retry-After': String(globalResult.retryAfterSec) });
  }

  if (inFlight >= MAX_IN_FLIGHT) return fail(503, 'busy');
  inFlight++;
  try {
    // 2. Server config. No fallback recipient.
    const config = readConfig();
    if (!config) {
      if (!missingConfigLogged) {
        console.error('feedback: missing config');
        missingConfigLogged = true;
      }
      return fail(503, 'unavailable');
    }

    // 3. Content type.
    const contentType = (req.headers.get('content-type') ?? '').toLowerCase();
    if (!contentType.startsWith('application/json')) return fail(415, 'unsupported_media_type');

    // 4. Declared length, before reading anything.
    const declaredLength = req.headers.get('content-length');
    if (declaredLength !== null && Number(declaredLength) > FEEDBACK_LIMITS.maxBodyBytes) {
      return fail(413, 'payload_too_large');
    }

    // 5. Streamed read with a hard cap (covers chunked bodies without Content-Length) and a
    //    deadline, so a trickling client cannot hold an in-flight slot.
    const body = await readLimitedBody(req.body, FEEDBACK_LIMITS.maxBodyBytes, {
      timeoutMs: BODY_READ_TIMEOUT_MS,
    });
    if (!body.ok) return body.reason === 'timeout' ? fail(408, 'timeout') : fail(413, 'payload_too_large');

    // 6. JSON. The structure pre-scan keeps JSON.parse from building a huge object graph
    //    (deep nesting or millions of tiny values) out of a body that is within the byte cap.
    if (!hasSmallJsonStructure(body.bytes)) return fail(400, 'invalid_request');
    let json: unknown;
    try {
      json = JSON.parse(new TextDecoder().decode(body.bytes));
    } catch {
      return fail(400, 'invalid_request');
    }

    // 7. Payload.
    const parsed = parseFeedbackPayload(json);
    if (!parsed.ok) {
      return parsed.reason === 'too_large' ? fail(413, 'payload_too_large') : fail(400, 'invalid_request');
    }
    const { message, attachments } = parsed.value;

    // 8. Optional sender identity, only from a verified Firebase ID token (anonymous allowed).
    let claims: VerifiedIdToken | null = null;
    const authorization = req.headers.get('authorization');
    if (authorization !== null) {
      const match = /^Bearer (\S+)$/.exec(authorization);
      if (!match) return fail(401, 'unauthorized');
      const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
      if (!projectId) return fail(503, 'unavailable');
      try {
        claims = await verifyIdToken(match[1], { projectId });
      } catch (err) {
        if (err instanceof KeySetUnavailableError) return fail(503, 'unavailable');
        return fail(401, 'unauthorized');
      }
    }

    // 9. Mail. An unverified email appears nowhere in it.
    const email = claims?.emailVerified === true && claims.email ? claims.email : '';
    const displayName = (claims ? claims.name || email || claims.uid : 'anonymous').replace(/[\r\n]/g, '');
    const text = `Sender: ${displayName} ${email ? `<${email}>` : ''}\n\nMessage:\n${message}`;

    // 10. Send.
    let messageId: string;
    try {
      const info = await getTransporter(config).sendMail({
        from: config.user,
        to: config.recipient,
        subject: 'SpotOn_feedback',
        text,
        replyTo: email || undefined,
        attachments,
      });
      messageId = info.messageId;
    } catch (err) {
      console.error('feedback: send failed', err instanceof Error ? err.name : 'unknown');
      return fail(502, 'send_failed');
    }

    // 11. Done. Never log the message, emails or tokens.
    console.log('feedback sent', { messageId, attachments: attachments.length });
    return reply(200, { ok: true });
  } finally {
    inFlight--;
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    return await handle(req);
  } catch (err) {
    console.error('feedback: server error', err instanceof Error ? err.name : 'unknown');
    return fail(500, 'server_error');
  }
}
