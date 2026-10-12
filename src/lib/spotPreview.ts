// The public preview of a shared spot link (/spot/<id>): name, description, category and photo of an
// approved spot, read on the server through the Firestore REST API with the public web config (the
// rules let anyone read approved spots). Anything else (pending, rejected, missing) is null.
import { isValidSpotIdClient } from './spotLinks';

export interface SpotPreview {
  id: string;
  name: string;
  description: string;
  imageUrl: string | null;
  rating: number | null;
}

export type Value = { stringValue?: string; booleanValue?: boolean; integerValue?: string; doubleValue?: number; arrayValue?: { values?: Value[] }; mapValue?: { fields?: Record<string, Value> } };

export function str(v: Value | undefined): string {
  return typeof v?.stringValue === 'string' ? v.stringValue : '';
}

function num(v: Value | undefined): number | null {
  if (v?.integerValue !== undefined) return Number(v.integerValue);
  return typeof v?.doubleValue === 'number' ? v.doubleValue : null;
}

/**
 * A Firestore REST address under the database's documents (`path` already encoded), with the
 * public API key: the emulator (local and e2e runs) when the server has one, else Firestore.
 * `verb` is a method suffix such as ":runQuery". Null without a project.
 */
export function firestoreRestUrl(path: string, verb = ''): string | null {
  const project = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!project) return null;
  const emulator = process.env.NEXT_PUBLIC_USE_EMULATORS === '1' ? process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080' : '';
  const host = emulator ? `http://${emulator}` : 'https://firestore.googleapis.com';
  const key = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const base = `${host}/v1/projects/${project}/databases/(default)/documents${path ? `/${path}` : ''}${verb}`;
  return `${base}${key ? `?key=${encodeURIComponent(key)}` : ''}`;
}

function documentUrl(spotId: string): string | null {
  return firestoreRestUrl(`spots/${encodeURIComponent(spotId)}`);
}

/** Parses a Firestore REST document into a preview (approved only). */
export function previewFromDocument(id: string, doc: { fields?: Record<string, Value> } | null): SpotPreview | null {
  const f = doc?.fields;
  if (!f || str(f.status) !== 'approved') return null;
  // primaryImageIndex points into the stored list; only https photos can be a link preview.
  const all = (f.imageUrls?.arrayValue?.values ?? []).map(str);
  const urls = all.filter((u) => u.startsWith('https://'));
  const chosen = all[num(f.primaryImageIndex) ?? 0];
  const ratings = (f.reviews?.arrayValue?.values ?? []).map((r) => num(r.mapValue?.fields?.rating)).filter((r): r is number => r !== null);
  return {
    id,
    name: str(f.name),
    description: str(f.description).slice(0, 200),
    imageUrl: chosen?.startsWith('https://') ? chosen : urls[0] ?? null,
    rating: ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : null,
  };
}

export async function fetchSpotPreview(spotId: string): Promise<SpotPreview | null> {
  if (!isValidSpotIdClient(spotId)) return null;
  const url = documentUrl(spotId);
  if (!url) return null;
  try {
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    return previewFromDocument(spotId, await res.json());
  } catch {
    return null;
  }
}
