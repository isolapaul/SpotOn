// Translation keys for failed background uploads (G4). Pure.
import type { TranslationKey } from './translations';
import { TIMEOUT } from './withTimeout';

/** Thrown when the spot would exceed MAX_SPOT_IMAGES (client check or the server's resource-exhausted). */
export const MAX_SPOT_IMAGES_ERROR = 'MAX_SPOT_IMAGES';
/** The server's resource-exhausted when a user already has too many photos waiting on a spot. */
export const MAX_PENDING_PHOTOS_ERROR = 'MAX_PENDING_PHOTOS';

/**
 * The message key for a failed upload job: a timeout (ours or a callable's deadline-exceeded) and
 * the image limit and the waiting-photo limit have their own texts; anything else gets the job's generic `fallback`.
 */
export function uploadErrorKey(error: unknown, fallback: TranslationKey): TranslationKey {
  const message = error instanceof Error ? error.message : undefined;
  const code = typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : undefined;
  if (message === TIMEOUT || code === 'functions/deadline-exceeded') return 'uploadTimeout';
  if (message === MAX_SPOT_IMAGES_ERROR) return 'maxSpotImages';
  if (message === MAX_PENDING_PHOTOS_ERROR) return 'maxPendingPhotos';
  return fallback;
}
