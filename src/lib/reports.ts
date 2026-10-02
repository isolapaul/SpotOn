// Reports for the admin queue (Play UGC requirement). Pure.
import type { ReportKind, ReportReason } from '@/store/useSafetyStore';

export interface ReportItem {
  id: string;
  key: string;
  kind: ReportKind;
  spotId: string;
  targetId: string;
  reason: ReportReason;
  text: string;
  spotName: string;
  preview: string;
  createdAt: number;
}

/** One reported thing with all its reports (newest first), for one decision. */
export interface ReportGroup {
  key: string;
  kind: ReportKind;
  spotId: string;
  targetId: string;
  spotName: string;
  preview: string;
  reports: ReportItem[];
}

const KINDS: readonly string[] = ['spot', 'photo', 'review', 'reply', 'profile'];

export function parseReport(id: string, d: Record<string, unknown>): ReportItem | null {
  if (typeof d.key !== 'string' || typeof d.kind !== 'string' || !KINDS.includes(d.kind) || typeof d.targetId !== 'string') return null;
  const at = d.createdAt as { toMillis?: () => number } | null | undefined;
  return {
    id,
    key: d.key,
    kind: d.kind as ReportKind,
    spotId: typeof d.spotId === 'string' ? d.spotId : '',
    targetId: d.targetId,
    reason: (typeof d.reason === 'string' ? d.reason : 'other') as ReportReason,
    text: typeof d.text === 'string' ? d.text : '',
    spotName: typeof d.spotName === 'string' ? d.spotName : '',
    preview: typeof d.preview === 'string' ? d.preview : '',
    createdAt: at?.toMillis?.() ?? Date.now(),
  };
}

/** Groups reports by the reported thing; the most reported (then the newest) first. */
export function groupReports(items: readonly ReportItem[]): ReportGroup[] {
  const groups = new Map<string, ReportGroup>();
  for (const r of [...items].sort((a, b) => b.createdAt - a.createdAt)) {
    const g = groups.get(r.key);
    if (g) g.reports.push(r);
    else groups.set(r.key, { key: r.key, kind: r.kind, spotId: r.spotId, targetId: r.targetId, spotName: r.spotName, preview: r.preview, reports: [r] });
  }
  return [...groups.values()].sort((a, b) => b.reports.length - a.reports.length || b.reports[0].createdAt - a.reports[0].createdAt);
}
