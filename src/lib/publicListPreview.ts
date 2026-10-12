// The public web page of a public list (growth plan §7, /list/<uid>/<listId>): the list, its
// owner's name and its approved spots, read on the server through the Firestore REST API with the
// public config (the rules let anyone read public lists, public profiles and approved spots).
import { firestoreRestUrl, previewFromDocument, str, type SpotPreview, type Value } from './spotPreview';

export interface PublicListPreview {
  name: string;
  owner: string;
  spots: SpotPreview[];
}

type Doc = { name?: string; fields?: Record<string, Value> };

const ID = /^[\w-]{1,128}$/;
const MAX_SPOTS = 60;

async function getJson(url: string | null, init?: RequestInit): Promise<unknown> {
  if (!url) return null;
  const res = await fetch(url, { ...init, next: { revalidate: 300 } });
  return res.ok ? res.json() : null;
}

/** The ids of a list document's spots, if it is public. */
export function publicListSpotIds(doc: Doc | null): { name: string; spotIds: string[] } | null {
  const f = doc?.fields;
  if (!f || f.public?.booleanValue !== true) return null;
  const spotIds = (f.spotIds?.arrayValue?.values ?? []).map(str).filter((id) => ID.test(id));
  return { name: str(f.name), spotIds };
}

export async function fetchPublicListPreview(uid: string, listId: string): Promise<PublicListPreview | null> {
  if (!ID.test(uid) || !ID.test(listId)) return null;
  try {
    const list = publicListSpotIds(await getJson(firestoreRestUrl(`users/${uid}/lists/${listId}`)) as Doc | null);
    if (!list) return null;
    const profile = await getJson(firestoreRestUrl(`publicProfiles/${uid}`)) as Doc | null;
    const ids = list.spotIds.slice(0, MAX_SPOTS);
    const project = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const batch = ids.length && project
      ? await getJson(firestoreRestUrl('', ':batchGet'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ documents: ids.map((id) => `projects/${project}/databases/(default)/documents/spots/${id}`) }),
      }) as Array<{ found?: Doc }> | null
      : [];
    const byId = new Map<string, SpotPreview>();
    for (const entry of batch ?? []) {
      const id = entry.found?.name?.split('/').pop();
      const preview = id ? previewFromDocument(id, entry.found ?? null) : null;
      if (id && preview) byId.set(id, preview);
    }
    return {
      name: list.name,
      owner: str(profile?.fields?.username),
      spots: ids.map((id) => byId.get(id)).filter((s): s is SpotPreview => !!s),
    };
  } catch {
    return null;
  }
}
