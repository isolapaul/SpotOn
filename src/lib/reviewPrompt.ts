// The store rating prompt (growth plan §9), pure: asked after a happy moment (the user's spot was
// approved), at most once every REVIEW_PROMPT_GAP_DAYS; the system decides whether it shows.
export const REVIEW_PROMPT_GAP_DAYS = 120;

export function mayAskForReview(lastAskedMs: number | null, now: number): boolean {
  return lastAskedMs === null || now - lastAskedMs >= REVIEW_PROMPT_GAP_DAYS * 24 * 60 * 60 * 1000;
}
