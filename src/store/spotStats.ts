// Views and visits (growth plan §3, §4): the public counters in spotStats/{spotId} and the view
// record (recordSpotView: once per person, spot and day on the server; once per session here).
import { doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/lib/firebase';

export interface SpotCounts {
  views: number;
  visits: number;
}

const recordViewCallable = httpsCallable<{ spotId: string }, { counted: boolean }>(functions, 'recordSpotView');
const recorded = new Set<string>();

const n = (x: unknown) => (typeof x === 'number' && x > 0 ? Math.floor(x) : 0);

export async function fetchSpotCounts(spotId: string): Promise<SpotCounts> {
  const snap = await getDoc(doc(db, 'spotStats', spotId));
  return { views: n(snap.get('viewCount')), visits: n(snap.get('visitCount')) };
}

/** Counts a view of the details (signed in only; silent on failure). True when the server counted it. */
export async function recordSpotView(spotId: string): Promise<boolean> {
  if (recorded.has(spotId)) return false;
  recorded.add(spotId);
  try {
    return (await recordViewCallable({ spotId })).data.counted;
  } catch {
    return false;
  }
}
