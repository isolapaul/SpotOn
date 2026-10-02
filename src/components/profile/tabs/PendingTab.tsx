'use client';

import { useState } from 'react';
import type { Spot } from '@/store/useSpotStore';
import { useModerationStore } from '@/store/useModerationStore';
import { useT } from '@/hooks/useT';
import type { TranslationKey } from '@/lib/translations';
import SpotQueue from '../../moderation/SpotQueue';
import EditQueue from '../../moderation/EditQueue';
import PhotoQueue from '../../moderation/PhotoQueue';
import ReportQueue from '../../moderation/ReportQueue';

type Queue = 'spots' | 'edits' | 'photos' | 'reports';

const QUEUES: ReadonlyArray<{ id: Queue; label: TranslationKey }> = [
  { id: 'spots', label: 'queueSpots' },
  { id: 'edits', label: 'queueEdits' },
  { id: 'photos', label: 'queuePhotos' },
  { id: 'reports', label: 'queueReports' },
];

interface PendingTabProps {
  spots: Spot[];
  onOpenSpot: (spotId: string) => void;
}

/** Admin review (item 4): new spots, proposed edits, added photos and reports, each with its count. */
export default function PendingTab({ spots, onOpenSpot }: Readonly<PendingTabProps>) {
  const t = useT();
  const edits = useModerationStore((s) => s.editQueue);
  const photos = useModerationStore((s) => s.photoQueue);
  const reports = useModerationStore((s) => s.reportQueue);
  const [queue, setQueue] = useState<Queue>('spots');
  const counts: Record<Queue, number> = { spots: spots.length, edits: edits.length, photos: photos.length, reports: reports.length };
  const index = QUEUES.findIndex((q) => q.id === queue);

  return (
    <div className="space-y-4">
      <div role="radiogroup" className="relative grid grid-cols-4 p-0.5 rounded-[10px] bg-white/8">
        <span
          aria-hidden="true"
          className="absolute top-0.5 bottom-0.5 left-0.5 w-[calc((100%-4px)/4)] rounded-r1 bg-white/16 shadow-xs transition-transform duration-350 ease-ios"
          style={{ transform: `translateX(${index * 100}%)` }}
        />
        {QUEUES.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={queue === id}
            onClick={() => setQueue(id)}
            className="no-min-size relative h-8 flex items-center justify-center gap-1.5 text-[13px] font-semibold text-label touch-manipulation"
          >
            {t(label)}
            {counts[id] > 0 && (
              <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-warn-500 text-warn-ink text-[11px] font-bold leading-[18px] tabular-nums">
                {counts[id]}
              </span>
            )}
          </button>
        ))}
      </div>
      {queue === 'spots' && <SpotQueue spots={spots} onOpenSpot={onOpenSpot} />}
      {queue === 'edits' && <EditQueue edits={edits} onOpenSpot={onOpenSpot} />}
      {queue === 'photos' && <PhotoQueue photos={photos} />}
      {queue === 'reports' && <ReportQueue onOpenSpot={onOpenSpot} />}
    </div>
  );
}
