// The super admin's view of the anonymous telemetry (stats/{day}, clientErrors/{hash}; rules).
import { collection, documentId, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { summarizeStats, type DayStats } from '@/lib/telemetry';

export interface ClientErrorRow {
  id: string;
  message: string;
  path: string;
  platform: string;
  version: string;
  count: number;
  lastSeen: number;
}

export async function loadTelemetry(days = 30): Promise<{ days: DayStats[]; errors: ClientErrorRow[] }> {
  const [stats, errors] = await Promise.all([
    getDocs(query(collection(db, 'stats'), orderBy(documentId(), 'desc'), limit(days))),
    getDocs(query(collection(db, 'clientErrors'), orderBy('lastSeen', 'desc'), limit(20))),
  ]);
  return {
    days: summarizeStats(stats.docs.map((d) => ({ id: d.id, data: d.data() }))),
    errors: errors.docs.map((d) => {
      const x = d.data();
      return {
        id: d.id,
        message: String(x.message ?? ''),
        path: String(x.path ?? ''),
        platform: String(x.platform ?? ''),
        version: String(x.version ?? ''),
        count: typeof x.count === 'number' ? x.count : 0,
        lastSeen: typeof x.lastSeen?.toMillis === 'function' ? x.lastSeen.toMillis() : 0,
      };
    }),
  };
}
