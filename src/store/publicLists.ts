// Public lists (growth plan §7): found by anyone (collection-group queries on public lists, rules),
// opened in the app and on the web (/list/<uid>/<listId>).
import { collectionGroup, doc, endAt, getDoc, getDocs, limit, orderBy, query, startAt, where, type QueryDocumentSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { listNameKey } from '@/lib/lists';

export interface PublicListHit {
  uid: string;
  id: string;
  name: string;
  spotIds: string[];
}

const LIMIT = 20;

function hit(d: QueryDocumentSnapshot): PublicListHit | null {
  const uid = d.ref.parent.parent?.id;
  const name = d.get('name');
  if (!uid || typeof name !== 'string') return null;
  const spotIds = d.get('spotIds');
  return { uid, id: d.id, name, spotIds: Array.isArray(spotIds) ? spotIds.filter((x): x is string => typeof x === 'string') : [] };
}

/** Public lists whose name starts with `prefix` (case-insensitive). */
export async function searchPublicLists(prefix: string): Promise<PublicListHit[]> {
  const key = listNameKey(prefix);
  const snap = await getDocs(query(
    collectionGroup(db, 'lists'), where('public', '==', true), orderBy('nameLower'), startAt(key), endAt(`${key}`), limit(LIMIT),
  ));
  return snap.docs.map(hit).filter((h): h is PublicListHit => h !== null);
}

/** The most recently updated public lists. */
export async function recentPublicLists(): Promise<PublicListHit[]> {
  const snap = await getDocs(query(collectionGroup(db, 'lists'), where('public', '==', true), orderBy('updatedAt', 'desc'), limit(LIMIT)));
  return snap.docs.map(hit).filter((h): h is PublicListHit => h !== null);
}

/** One public list (null when missing or not public). */
export async function fetchPublicList(uid: string, listId: string): Promise<PublicListHit | null> {
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'lists', listId));
    if (!snap.exists() || snap.get('public') !== true) return null;
    return hit(snap as QueryDocumentSnapshot);
  } catch {
    // Not public (the rules refuse it) or offline.
    return null;
  }
}
