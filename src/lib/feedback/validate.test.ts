import { describe, expect, it } from 'vitest';
import {
  detectImageType,
  FEEDBACK_LIMITS,
  hasSmallJsonStructure,
  parseFeedbackPayload,
  sanitizeFilename,
} from './validate';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16]);
const WEBP = Buffer.from([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50]);
const GIF = Buffer.from('GIF89a\x01\x00\x01\x00', 'latin1');

const dataUrl = (buf: Buffer, mime = 'image/png') => `data:${mime};base64,${buf.toString('base64')}`;
/** Buffer of `size` bytes that starts with PNG magic. */
const pngOfSize = (size: number) => {
  const buf = Buffer.alloc(size, 7);
  PNG.copy(buf, 0, 0, 8);
  return buf;
};

describe('detectImageType', () => {
  it('accepts each magic-byte type', () => {
    expect(detectImageType(JPEG)).toBe('jpeg');
    expect(detectImageType(PNG)).toBe('png');
    expect(detectImageType(WEBP)).toBe('webp');
  });

  it('rejects GIF, text and empty buffers', () => {
    expect(detectImageType(GIF)).toBeNull();
    expect(detectImageType(Buffer.from('hello, this is plain text'))).toBeNull();
    expect(detectImageType(new Uint8Array(0))).toBeNull();
    // RIFF container that is not WebP
    expect(detectImageType(Buffer.from('RIFF\x00\x00\x00\x00WAVEfmt ', 'latin1'))).toBeNull();
  });
});

describe('sanitizeFilename', () => {
  it('takes the basename and uses the detected extension', () => {
    expect(sanitizeFilename('../../etc/passwd.png', 0, 'png')).toBe('passwd.png');
    expect(sanitizeFilename('C:\\Users\\x\\photo.JPG', 0, 'jpeg')).toBe('photo.jpg');
  });

  it('replaces unsafe characters and collapses underscores', () => {
    expect(sanitizeFilename('a b<>.jpeg', 0, 'png')).toBe('a_b_.png');
  });

  it('trims leading dots', () => {
    expect(sanitizeFilename('...hidden.name.webp', 0, 'webp')).toBe('hidden.name.webp');
  });

  it('cuts long names to maxFilenameChars', () => {
    const out = sanitizeFilename(`${'x'.repeat(100)}.png`, 0, 'png');
    expect(out).toBe(`${'x'.repeat(FEEDBACK_LIMITS.maxFilenameChars)}.png`);
  });

  it('falls back to feedback-N when empty or not a string', () => {
    expect(sanitizeFilename('', 0, 'jpeg')).toBe('feedback-1.jpg');
    expect(sanitizeFilename(undefined, 1, 'png')).toBe('feedback-2.png');
    expect(sanitizeFilename({ evil: true }, 2, 'webp')).toBe('feedback-3.webp');
  });
});

describe('parseFeedbackPayload', () => {
  it('accepts a valid text-only payload and trims the message', () => {
    expect(parseFeedbackPayload({ message: '  hello  ' })).toEqual({
      ok: true,
      value: { message: 'hello', attachments: [] },
    });
  });

  it('accepts each image type and takes the content type from magic bytes', () => {
    const r = parseFeedbackPayload({
      message: 'hi',
      attachments: [
        { dataUrl: dataUrl(JPEG, 'application/octet-stream'), filename: 'a.png' },
        { dataUrl: dataUrl(PNG, 'image/gif'), filename: 'b' },
        { dataUrl: dataUrl(WEBP) },
      ],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.attachments.map((a) => [a.filename, a.contentType])).toEqual([
      ['a.jpg', 'image/jpeg'],
      ['b.png', 'image/png'],
      ['feedback-3.webp', 'image/webp'],
    ]);
    expect(Buffer.compare(r.value.attachments[1].content, PNG)).toBe(0);
  });

  it('rejects non-object roots and non-string messages', () => {
    for (const root of [null, 'hi', 42, [{ message: 'hi' }]]) {
      expect(parseFeedbackPayload(root)).toEqual({ ok: false, reason: 'invalid' });
    }
    for (const message of [undefined, 42, null, ['hi'], { text: 'hi' }]) {
      expect(parseFeedbackPayload({ message })).toEqual({ ok: false, reason: 'invalid' });
    }
  });

  it('enforces message length 1..5000 after trimming', () => {
    expect(parseFeedbackPayload({ message: '' })).toEqual({ ok: false, reason: 'invalid' });
    expect(parseFeedbackPayload({ message: '   ' })).toEqual({ ok: false, reason: 'invalid' });
    expect(parseFeedbackPayload({ message: 'x'.repeat(5000) }).ok).toBe(true);
    expect(parseFeedbackPayload({ message: 'x'.repeat(5001) })).toEqual({ ok: false, reason: 'invalid' });
  });

  it('rejects GIF, mislabelled text and empty attachments', () => {
    const cases = [
      dataUrl(GIF, 'image/gif'),
      dataUrl(Buffer.from('definitely not an image'), 'image/png'),
      'data:image/png;base64,',
    ];
    for (const d of cases) {
      expect(parseFeedbackPayload({ message: 'hi', attachments: [{ dataUrl: d }] })).toEqual({
        ok: false,
        reason: 'invalid',
      });
    }
  });

  it('rejects base64 with an illegal character and malformed data URLs', () => {
    const b64 = PNG.toString('base64');
    const cases = [
      `data:image/png;base64,${b64.slice(0, 4)}*${b64.slice(4)}`,
      `data:image/png;base64,${b64.slice(0, 4)} ${b64.slice(4)}`,
      `data:image/png,${b64}`,
      `data:IMAGE/PNG;base64,${b64}`,
      `image/png;base64,${b64}`,
    ];
    for (const d of cases) {
      expect(parseFeedbackPayload({ message: 'hi', attachments: [{ dataUrl: d }] })).toEqual({
        ok: false,
        reason: 'invalid',
      });
    }
    expect(parseFeedbackPayload({ message: 'hi', attachments: [{ filename: 'x.png' }] })).toEqual({
      ok: false,
      reason: 'invalid',
    });
    expect(parseFeedbackPayload({ message: 'hi', attachments: ['x'] })).toEqual({ ok: false, reason: 'invalid' });
    expect(parseFeedbackPayload({ message: 'hi', attachments: 'x' })).toEqual({ ok: false, reason: 'invalid' });
  });

  it('rejects more than 3 attachments', () => {
    const a = { dataUrl: dataUrl(PNG) };
    expect(parseFeedbackPayload({ message: 'hi', attachments: [a, a, a] }).ok).toBe(true);
    expect(parseFeedbackPayload({ message: 'hi', attachments: [a, a, a, a] })).toEqual({
      ok: false,
      reason: 'invalid',
    });
  });

  it('accepts an attachment exactly at the byte limit', () => {
    const r = parseFeedbackPayload({
      message: 'hi',
      attachments: [{ dataUrl: dataUrl(pngOfSize(FEEDBACK_LIMITS.maxAttachmentBytes)) }],
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.attachments[0].content.length).toBe(FEEDBACK_LIMITS.maxAttachmentBytes);
  });

  it('rejects an attachment one byte over the limit as too_large (padded and unpadded base64)', () => {
    const over = pngOfSize(FEEDBACK_LIMITS.maxAttachmentBytes + 1);
    const padded = dataUrl(over);
    expect(padded.endsWith('=')).toBe(true);
    const unpadded = padded.replace(/=+$/, '');
    for (const d of [padded, unpadded]) {
      expect(parseFeedbackPayload({ message: 'hi', attachments: [{ dataUrl: d }] })).toEqual({
        ok: false,
        reason: 'too_large',
      });
    }
  });

  it('ignores sender fields and other extra keys', () => {
    const r = parseFeedbackPayload({
      message: 'hi',
      senderEmail: 'evil@example.com',
      senderName: 'Admin',
      attachments: [{ dataUrl: dataUrl(PNG), mime: 'text/html', filename: 'x.png' }],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(Object.keys(r.value).sort()).toEqual(['attachments', 'message']);
    expect(Object.keys(r.value.attachments[0]).sort()).toEqual(['content', 'contentType', 'filename']);
    expect(JSON.stringify(r.value)).not.toContain('evil@example.com');
    expect(JSON.stringify(r.value)).not.toContain('Admin');
  });
});

describe('hasSmallJsonStructure', () => {
  const enc = (s: string) => new TextEncoder().encode(s);

  it('passes the real client payload (depth 3, 3 attachments)', () => {
    const attachment = { filename: 'photo.jpg', dataUrl: dataUrl(pngOfSize(1_000_000)) };
    const body = JSON.stringify({ message: 'hello\n"quoted" [x] {y}', attachments: [attachment, attachment, attachment] });
    expect(hasSmallJsonStructure(enc(body))).toBe(true);
    expect(hasSmallJsonStructure(enc(JSON.stringify({ message: 'text only' })))).toBe(true);
    expect(hasSmallJsonStructure(enc(''))).toBe(true); // JSON.parse rejects it afterwards
  });

  it('rejects nesting deeper than 3', () => {
    expect(hasSmallJsonStructure(enc('[[[1]]]'))).toBe(true);
    expect(hasSmallJsonStructure(enc('[[[[1]]]]'))).toBe(false);
    expect(hasSmallJsonStructure(enc('{"a":{"b":{"c":{"d":1}}}}'))).toBe(false);
    expect(hasSmallJsonStructure(enc('['.repeat(100_000) + ']'.repeat(100_000)))).toBe(false);
  });

  it('rejects wide payloads (more than 64 structural tokens)', () => {
    const wide = (n: number, v: string) => `{"message":"x","j":[${Array(n).fill(v).join(',')}]}`;
    expect(hasSmallJsonStructure(enc(wide(10, '{}')))).toBe(true);
    expect(hasSmallJsonStructure(enc(wide(100, '{}')))).toBe(false);
    expect(hasSmallJsonStructure(enc(wide(100, '0')))).toBe(false);
    expect(hasSmallJsonStructure(enc(wide(100, '""')))).toBe(false);
    expect(hasSmallJsonStructure(enc(wide(1_000_000, '0')))).toBe(false);
  });

  it('ignores brackets, commas, colons and escaped quotes inside strings', () => {
    const inString = '[[[[{{{{,,,,::::'.repeat(100);
    expect(hasSmallJsonStructure(enc(JSON.stringify({ message: inString })))).toBe(true);
    // escaped quote does not end the string: the brackets after it are still string content
    expect(hasSmallJsonStructure(enc('{"message":"a\\"[[[[[[,,,,"}'))).toBe(true);
    // escaped backslash then a real closing quote: the brackets after it are structure
    expect(hasSmallJsonStructure(enc('{"message":"a\\\\","x":[[[[1]]]]}'))).toBe(false);
  });
});
