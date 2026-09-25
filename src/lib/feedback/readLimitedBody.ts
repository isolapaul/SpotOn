export type LimitedBodyResult =
  | { ok: true; bytes: Uint8Array }
  | { ok: false; reason: 'too_large' | 'timeout' };

export type ReadLimitedBodyOptions = {
  /** Deadline for reading the whole body (default 15 s). */
  timeoutMs?: number;
};

const INITIAL_CAPACITY = 64 * 1024;

/**
 * Reads a request body stream up to `max` bytes into one buffer.
 * - Chunks are copied into a single growing buffer (never retained), so a body split into millions
 *   of tiny chunks costs no more memory than its byte size.
 * - As soon as the next chunk would take the total over `max`, the stream is cancelled and
 *   `{ ok: false, reason: 'too_large' }` is returned, so an oversized body is never buffered.
 * - If the whole body has not arrived within `timeoutMs`, the stream is cancelled and
 *   `{ ok: false, reason: 'timeout' }` is returned (a trickling client cannot hold a slot).
 */
export async function readLimitedBody(
  body: ReadableStream<Uint8Array> | null,
  max: number,
  { timeoutMs = 15_000 }: ReadLimitedBodyOptions = {},
): Promise<LimitedBodyResult> {
  if (!body) return { ok: true, bytes: new Uint8Array(0) };

  const reader = body.getReader();
  const cancel = async () => {
    try {
      await reader.cancel();
    } catch {
      // already errored/closed: nothing left to release
    }
  };

  // One timer for the whole read. Cancelling the reader resolves a pending read() with done=true,
  // so no per-chunk timer or promise race is needed.
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    void cancel();
  }, timeoutMs);

  try {
    let buf = new Uint8Array(Math.min(max, INITIAL_CAPACITY));
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (timedOut) return { ok: false, reason: 'timeout' };
      if (done) break;
      if (total + value.byteLength > max) {
        await cancel();
        return { ok: false, reason: 'too_large' };
      }
      if (total + value.byteLength > buf.byteLength) {
        let capacity = Math.max(buf.byteLength, 1);
        while (capacity < total + value.byteLength) capacity *= 2;
        const grown = new Uint8Array(Math.min(capacity, max));
        grown.set(buf.subarray(0, total));
        buf = grown;
      }
      buf.set(value, total);
      total += value.byteLength;
    }
    return { ok: true, bytes: buf.subarray(0, total) };
  } finally {
    clearTimeout(timer);
  }
}
