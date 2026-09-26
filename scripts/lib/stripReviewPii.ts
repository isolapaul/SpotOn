// Pure helper for scripts/strip-review-pii.ts (T13): removes leaked reviewer PII (SEC-03) and
// spoofable metadata (SEC-05) from embedded spots/{id}.reviews[] elements. No imports, no I/O.

export const PII_REVIEW_KEYS = ['userEmail', 'userSpotsCount', 'customNameColor', 'customNameFont'] as const;

export interface StripResult {
  /** True when at least one review lost a key; only then may the caller write. */
  changed: boolean;
  /** The reviews in their original order; unchanged elements keep their identity. */
  reviews: unknown[];
  /** Number of reviews that had at least one key removed. */
  strippedCount: number;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Returns `reviews` with the PII_REVIEW_KEYS removed from every plain-object element.
 * Every other key, its value and the key order are kept; non-object elements are kept as they are;
 * elements are never added, removed or reordered.
 * A non-array input gives `{changed: false, reviews: [], strippedCount: 0}`: the caller must skip the doc.
 */
export function stripReviews(reviews: unknown): StripResult {
  if (!Array.isArray(reviews)) return { changed: false, reviews: [], strippedCount: 0 };

  let strippedCount = 0;
  const out = reviews.map((review: unknown) => {
    if (!isPlainObject(review)) return review;
    if (!PII_REVIEW_KEYS.some((key) => Object.prototype.hasOwnProperty.call(review, key))) return review;
    strippedCount++;
    const kept: Record<string, unknown> = {};
    for (const key of Object.keys(review)) {
      if (!(PII_REVIEW_KEYS as readonly string[]).includes(key)) kept[key] = review[key];
    }
    return kept;
  });

  return { changed: strippedCount > 0, reviews: out, strippedCount };
}
