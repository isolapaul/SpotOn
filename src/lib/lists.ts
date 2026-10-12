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
  /** Growth plan §7: public — anyone can find it (search, the web page /list/<uid>/<id>). */
  public: boolean;
  updatedAt: number;
}

/** The search key of a list name (rules: nameLower == name.lower()). */
export function listNameKey(name: string): string {
  return name.trim().toLowerCase();
}

/** A public list's web address. */
export function publicListPath(uid: string, listId: string): string {
  return `/list/${encodeURIComponent(uid)}/${encodeURIComponent(listId)}`;
}

/** The uid and list id of a public list address, else null. */
export function publicListFromPath(path: string): { uid: string; listId: string } | null {
  const m = /^\/list\/([^/?#]+)\/([^/?#]+)\/?$/.exec(path);
  if (!m) return null;
  try {
    const uid = decodeURIComponent(m[1]);
    const listId = decodeURIComponent(m[2]);
    return /^[\w-]{1,128}$/.test(uid) && /^[\w-]{1,128}$/.test(listId) ? { uid, listId } : null;
  } catch {
    return null;
  }
}

export function parseList(id: string, d: Record<string, unknown>): SpotList | null {
  if (typeof d.name !== 'string' || !d.name.trim()) return null;
  const at = d.updatedAt as { toMillis?: () => number } | null | undefined;
  return {
    id,
    name: d.name.trim(),
    spotIds: Array.isArray(d.spotIds) ? d.spotIds.filter((x): x is string => typeof x === 'string') : [],
    shared: d.shared === true,
    public: d.public === true,
    updatedAt: at?.toMillis?.() ?? 0,
  };
}

/** The lists, most recently changed first. */
export function sortLists(lists: readonly SpotList[]): SpotList[] {
  return [...lists].sort((a, b) => b.updatedAt - a.updatedAt || a.name.localeCompare(b.name));
}
