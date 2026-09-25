// Pure validation for the feedback endpoint. No React, no Firebase, no Node-only APIs except
// Buffer (used only inside functions), so the client can import FEEDBACK_LIMITS from here.

export const FEEDBACK_LIMITS = {
  maxAttachments: 3,
  maxAttachmentBytes: 1_500_000,
  maxMessageChars: 5000,
  maxFilenameChars: 80,
  // 3 × base64(1.5 MB) = 6,000,000, plus the message and JSON overhead.
  maxBodyBytes: 6_300_000,
} as const;

export type ImageType = 'jpeg' | 'png' | 'webp';

export type FeedbackAttachment = { filename: string; content: Buffer; contentType: string };

export type ParseResult =
  | { ok: true; value: { message: string; attachments: FeedbackAttachment[] } }
  | { ok: false; reason: 'invalid' | 'too_large' };

const EXTENSIONS: Record<ImageType, string> = { jpeg: '.jpg', png: '.png', webp: '.webp' };
const CONTENT_TYPES: Record<ImageType, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const DATA_URL_RE = /^data:[a-z0-9.+/-]{1,64};base64,([A-Za-z0-9+/]+={0,2})$/;

function startsWith(buf: Uint8Array, bytes: readonly number[], offset = 0): boolean {
  if (buf.length < offset + bytes.length) return false;
  return bytes.every((b, i) => buf[offset + i] === b);
}

/** Detects the image type from its magic bytes; the client-declared MIME type is never trusted. */
export function detectImageType(buf: Uint8Array): ImageType | null {
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return 'jpeg';
  if (startsWith(buf, PNG_MAGIC)) return 'png';
  // RIFF ???? WEBP
  if (startsWith(buf, [0x52, 0x49, 0x46, 0x46]) && startsWith(buf, [0x57, 0x45, 0x42, 0x50], 8)) {
    return 'webp';
  }
  return null;
}

export function sanitizeFilename(raw: unknown, index: number, type: ImageType): string {
  let name = typeof raw === 'string' ? raw : '';
  // basename: strip everything up to the last / or \
  name = name.slice(Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\')) + 1);
  // drop the extension
  const dot = name.lastIndexOf('.');
  if (dot > 0) name = name.slice(0, dot);
  name = name
    .replace(/[^A-Za-z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^\.+/, '')
    .slice(0, FEEDBACK_LIMITS.maxFilenameChars);
  if (!name) name = `feedback-${index + 1}`;
  return name + EXTENSIONS[type];
}

const QUOTE = 0x22; // "
const BACKSLASH = 0x5c; // \
const OPEN_BRACE = 0x7b; // {
const OPEN_BRACKET = 0x5b; // [
const CLOSE_BRACE = 0x7d; // }
const CLOSE_BRACKET = 0x5d; // ]
const COMMA = 0x2c; // ,
const COLON = 0x3a; // :

/**
 * Cheap byte scan run before JSON.parse, so a body within the byte cap cannot still build a huge
 * object graph (deep nesting or millions of tiny values). Outside strings it counts nesting depth
 * of `{`/`[` and structural tokens (`{`, `[`, `,`, `:`); string contents (including escaped quotes
 * and brackets) are skipped. A real feedback payload has depth 3 and about 20 tokens.
 */
export function hasSmallJsonStructure(bytes: Uint8Array, maxDepth = 3, maxTokens = 64): boolean {
  let depth = 0;
  let tokens = 0;
  let inString = false;
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (inString) {
      if (b === BACKSLASH) i++; // skip the escaped byte
      else if (b === QUOTE) inString = false;
      continue;
    }
    switch (b) {
      case QUOTE:
        inString = true;
        break;
      case OPEN_BRACE:
      case OPEN_BRACKET:
        if (++depth > maxDepth || ++tokens > maxTokens) return false;
        break;
      case CLOSE_BRACE:
      case CLOSE_BRACKET:
        depth--;
        break;
      case COMMA:
      case COLON:
        if (++tokens > maxTokens) return false;
        break;
    }
  }
  return true;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Validates the parsed JSON body. Only `message` and `attachments[].{dataUrl, filename}` are read;
 * every other key (senderName, senderEmail, mime, …) is ignored.
 */
export function parseFeedbackPayload(json: unknown): ParseResult {
  if (!isPlainObject(json)) return { ok: false, reason: 'invalid' };

  if (typeof json.message !== 'string') return { ok: false, reason: 'invalid' };
  const message = json.message.trim();
  if (message.length < 1 || message.length > FEEDBACK_LIMITS.maxMessageChars) {
    return { ok: false, reason: 'invalid' };
  }

  const rawAttachments = json.attachments;
  if (rawAttachments !== undefined) {
    if (!Array.isArray(rawAttachments)) return { ok: false, reason: 'invalid' };
    if (rawAttachments.length > FEEDBACK_LIMITS.maxAttachments) return { ok: false, reason: 'invalid' };
  }

  const attachments: FeedbackAttachment[] = [];
  for (const [index, item] of (rawAttachments ?? []).entries()) {
    if (!isPlainObject(item) || typeof item.dataUrl !== 'string') return { ok: false, reason: 'invalid' };
    const match = DATA_URL_RE.exec(item.dataUrl);
    if (!match) return { ok: false, reason: 'invalid' };
    const b64 = match[1];

    // Estimated decoded size, checked before decoding.
    const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
    const estimated = Math.floor((b64.length * 3) / 4) - padding;
    if (estimated > FEEDBACK_LIMITS.maxAttachmentBytes) return { ok: false, reason: 'too_large' };

    const content = Buffer.from(b64, 'base64');
    if (content.length > FEEDBACK_LIMITS.maxAttachmentBytes) return { ok: false, reason: 'too_large' };

    const type = detectImageType(content);
    if (!type) return { ok: false, reason: 'invalid' };

    attachments.push({
      filename: sanitizeFilename(item.filename, index, type),
      content,
      contentType: CONTENT_TYPES[type],
    });
  }

  return { ok: true, value: { message, attachments } };
}
