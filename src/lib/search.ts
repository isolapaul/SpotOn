// Explore search helpers (item 8). Pure.

export const MIN_SEARCH_LENGTH = 2;
export const SPOT_SEARCH_LIMIT = 30;

/** Lowercase without accents, so "tihany" finds "Tihanyi apátság" and "apatsag" too. */
export function foldText(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/** Whether a spot name contains the query (accent- and case-insensitive). */
export function matchesSpotQuery(name: string, query: string): boolean {
  const q = foldText(query.trim());
  return q.length > 0 && foldText(name).includes(q);
}
