import { describe, expect, it } from 'vitest';
import { readLimitedBody } from './readLimitedBody';

function streamOf(chunks: Uint8Array[]) {
  const state = { cancelled: false, pulled: 0 };
  let i = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      state.pulled++;
      if (i < chunks.length) controller.enqueue(chunks[i++]);
      else controller.close();
    },
    cancel() {
      state.cancelled = true;
    },
  });
  return { stream, state };
}

/** A stream of `count` one-byte chunks (value = index & 0xff), generated lazily. */
function oneByteStream(count: number) {
  const state = { cancelled: false, enqueued: 0 };
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (state.enqueued < count) controller.enqueue(new Uint8Array([state.enqueued++ & 0xff]));
      else controller.close();
    },
    cancel() {
      state.cancelled = true;
    },
  });
  return { stream, state };
}

const bytes = (n: number, fill: number) => new Uint8Array(n).fill(fill);

describe('readLimitedBody', () => {
  it('returns all bytes of a stream under the limit', async () => {
    const chunks = [bytes(3, 1), bytes(4, 2), bytes(5, 3)];
    const { stream, state } = streamOf(chunks);
    const r = await readLimitedBody(stream, 12);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(Array.from(r.bytes)).toEqual([...chunks[0], ...chunks[1], ...chunks[2]]);
    expect(state.cancelled).toBe(false);
  });

  it('grows its buffer past the initial capacity', async () => {
    const chunks = [bytes(50_000, 1), bytes(50_000, 2), bytes(50_000, 3)];
    const r = await readLimitedBody(streamOf(chunks).stream, 1_000_000);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.bytes.byteLength).toBe(150_000);
    expect([r.bytes[0], r.bytes[50_000], r.bytes[149_999]]).toEqual([1, 2, 3]);
  });

  it('cancels the stream and fails as soon as the limit is exceeded', async () => {
    const chunks = [bytes(5, 1), bytes(5, 2), bytes(5, 3), bytes(5, 4)];
    const { stream, state } = streamOf(chunks);
    const r = await readLimitedBody(stream, 12);
    expect(r).toEqual({ ok: false, reason: 'too_large' });
    expect(state.cancelled).toBe(true);
    expect(state.pulled).toBeLessThan(chunks.length + 1); // did not drain the remaining chunks
  });

  it('accepts exactly max bytes', async () => {
    const r = await readLimitedBody(streamOf([bytes(6, 1), bytes(6, 2)]).stream, 12);
    expect(r.ok && r.bytes.byteLength).toBe(12);
  });

  it('handles ~100k one-byte chunks without retaining chunk objects', async () => {
    const count = 100_000;
    const r = await readLimitedBody(oneByteStream(count).stream, count);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.bytes.byteLength).toBe(count);
    expect(r.bytes[0]).toBe(0);
    expect(r.bytes[count - 1]).toBe((count - 1) & 0xff);
    expect(r.bytes.buffer.byteLength).toBeLessThanOrEqual(count); // grown ×2, capped at max
  });

  it('still enforces the cap with one-byte chunks', async () => {
    const { stream, state } = oneByteStream(100_001);
    const r = await readLimitedBody(stream, 100_000);
    expect(r).toEqual({ ok: false, reason: 'too_large' });
    expect(state.cancelled).toBe(true);
  });

  it('times out a trickling stream and cancels it', async () => {
    const state = { cancelled: false };
    let sent = false;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (!sent) {
          sent = true;
          controller.enqueue(bytes(1, 1));
          return;
        }
        return new Promise<void>(() => {}); // never delivers the rest
      },
      cancel() {
        state.cancelled = true;
      },
    });
    const started = Date.now();
    const r = await readLimitedBody(stream, 1000, { timeoutMs: 50 });
    expect(r).toEqual({ ok: false, reason: 'timeout' });
    expect(state.cancelled).toBe(true);
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it('treats a null body as empty', async () => {
    const r = await readLimitedBody(null, 10);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.bytes.byteLength).toBe(0);
  });
});
