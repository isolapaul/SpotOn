// Promise deadline for network steps that can hang (G4, #8). Pure.

/** The Error message a timed-out step rejects with. */
export const TIMEOUT = 'TIMEOUT';

/**
 * Resolves or rejects like `promise`, or rejects with Error(TIMEOUT) after `ms`. The underlying
 * work is not cancelled: a write may still land later, so callers make their retries idempotent.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(TIMEOUT)), ms);
  });
  return Promise.race([promise, deadline]).finally(() => clearTimeout(timer));
}
