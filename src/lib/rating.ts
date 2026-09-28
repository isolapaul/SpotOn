// Review rating helpers (T23, DUP-07). Pure: no React, Firebase or DOM.

/** Mean of the review ratings, or 0 when there are none. Formatting (toFixed) stays at call sites. */
export function averageRating(reviews?: ReadonlyArray<{ rating: number }>): number {
  return reviews && reviews.length > 0
    ? reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length
    : 0;
}
