// The user's own spot lists ("Sunsets", "For the weekend"). Pure.

export const MAX_LIST_NAME = 50;
export const MAX_LIST_SPOTS = 200;
export const MAX_LISTS = 30;

export interface SpotList {
  id: string;
  name: string;
  spotIds: string[];
  /** Shown on the owner's profile (like shared saved spots; a private profile only to followers). */
  shared: boolean;
  updatedAt: number;
}

export function parseList(id: string, d: Record<string, unknown>): SpotList | null {
  if (typeof d.name !== 'string' || !d.name.trim()) return null;
  const at = d.updatedAt as { toMillis?: () => number } | null | undefined;
  return {
    id,
    name: d.name.trim(),
    spotIds: Array.isArray(d.spotIds) ? d.spotIds.filter((x): x is string => typeof x === 'string') : [],
    shared: d.shared === true,
    updatedAt: at?.toMillis?.() ?? 0,
  };
}

/** The lists, most recently changed first. */
export function sortLists(lists: readonly SpotList[]): SpotList[] {
  return [...lists].sort((a, b) => b.updatedAt - a.updatedAt || a.name.localeCompare(b.name));
}
