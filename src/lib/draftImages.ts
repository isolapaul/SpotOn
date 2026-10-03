// Rules for the photos picked in a spot form before upload. Pure: no React, Firebase or DOM.
import { MAX_SPOT_IMAGES } from './spotImages';
import { MAX_UPLOAD_BYTES } from './constants';

export type DraftImageError = 'maxSpotImages' | 'imageTooLarge';

export interface DraftImageCheck {
  /** The files that may be added (all of them, or none when the limit would be exceeded). */
  accepted: File[];
  /** Why files were refused; null when none were. */
  error: DraftImageError | null;
}

/**
 * Checks newly picked files against the images already in the draft: the whole pick is refused
 * when it would exceed MAX_SPOT_IMAGES; otherwise only the files over MAX_UPLOAD_BYTES are dropped.
 */
export function checkDraftImages(existingCount: number, picked: readonly File[]): DraftImageCheck {
  if (existingCount + picked.length > MAX_SPOT_IMAGES) return { accepted: [], error: 'maxSpotImages' };
  const accepted = picked.filter((file) => file.size <= MAX_UPLOAD_BYTES);
  return { accepted, error: accepted.length < picked.length ? 'imageTooLarge' : null };
}

/** The primary image index after the image at `removed` is taken out. */
export function primaryAfterRemoval(primary: number, removed: number): number {
  if (removed === primary) return 0;
  return removed < primary ? primary - 1 : primary;
}
