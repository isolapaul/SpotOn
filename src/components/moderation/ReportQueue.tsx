'use client';

import { useState } from 'react';
import Image from 'next/image';
import { CheckCircle, Trash2 } from 'lucide-react';
import { useModerationStore } from '@/store/useModerationStore';
import { useToastStore } from '@/store/useToastStore';
import { useT } from '@/hooks/useT';
import type { ReportGroup } from '@/lib/reports';
import type { ReportKind, ReportReason } from '@/store/useSafetyStore';
import type { TranslationKey } from '@/lib/translations';
import Button from '../ui/Button';
import ReasonSheet from './ReasonSheet';
import QueueEmpty from './QueueEmpty';

const KIND_LABEL: Readonly<Record<ReportKind, TranslationKey>> = {
  spot: 'reportKindSpot',
  photo: 'reportKindPhoto',
  review: 'reportKindReview',
  reply: 'reportKindReply',
  profile: 'reportKindProfile',
};
const REASON_LABEL: Readonly<Record<ReportReason, TranslationKey>> = {
  spam: 'reportReasonSpam',
  offensive: 'reportReasonOffensive',
  wrong_place: 'reportReasonWrongPlace',
  dangerous: 'reportReasonDangerous',
  privacy: 'reportReasonPrivacy',
  other: 'reportReasonOther',
};

/** Admin: reported things (most reported first): dismiss the reports, or remove the thing with a reason. */
export default function ReportQueue({ onOpenSpot }: Readonly<{ onOpenSpot: (spotId: string) => void }>) {
  const t = useT();
  const groups = useModerationStore((s) => s.reportQueue);
  if (!groups.length) return <QueueEmpty text={t('noReports')} />;
  return (
    <div className="space-y-3">
      {groups.map((g) => <ReportCard key={g.key} group={g} onOpenSpot={onOpenSpot} />)}
    </div>
  );
}

function ReportCard({ group, onOpenSpot }: Readonly<{ group: ReportGroup; onOpenSpot: (spotId: string) => void }>) {
  const t = useT();
  const resolve = useModerationStore((s) => s.resolveReport);
  const showToast = useToastStore((s) => s.showToast);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState(false);
  const title = group.kind === 'profile' ? group.preview.split(':')[0] : group.spotName;

  const dismiss = async () => {
    setBusy(true);
    try {
      await resolve(group.key, false);
      showToast(t('reportDismissed'), 'success');
    } catch (error) {
      console.error('Dismiss failed:', error);
      showToast(t('moderationError'), 'error');
      setBusy(false);
    }
  };

  return (
    <section aria-label={title} className="rounded-[18px] bg-surface-1 p-4 space-y-3 motion-safe:animate-item-in">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] font-semibold uppercase tracking-wide text-label-tertiary">{t(KIND_LABEL[group.kind])}</span>
        <span className="text-[12px] font-semibold text-warn-500">{t('reportCount', { count: group.reports.length })}</span>
      </div>
      {group.spotId ? (
        <button type="button" onClick={() => onOpenSpot(group.spotId)} className="no-min-size text-left text-label font-semibold line-clamp-1">
          {group.spotName}
        </button>
      ) : (
        <p className="text-label font-semibold">{title}</p>
      )}
      {group.kind === 'photo' ? (
        <span className="relative block w-full aspect-4/3 rounded-r2 overflow-hidden bg-surface-3">
          <Image src={group.targetId} alt="" fill sizes="480px" unoptimized className="object-cover" />
        </span>
      ) : group.preview && (
        <p className="text-label-secondary text-[14px] whitespace-pre-line wrap-break-word line-clamp-4">
          {group.kind === 'profile' ? group.preview.split(':').slice(1).join(':').trim() || '–' : group.preview}
        </p>
      )}
      <ul className="rounded-[12px] bg-white/4 divide-y divide-white/6">
        {group.reports.slice(0, 5).map((r) => (
          <li key={r.id} className="px-3 py-2 text-[13px]">
            <span className="text-label font-medium">{t(REASON_LABEL[r.reason])}</span>
            {r.text && <span className="text-label-secondary">: {r.text}</span>}
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Button variant="gray" size="md" block onClick={dismiss} disabled={busy}>
          <CheckCircle className="w-4 h-4" aria-hidden="true" />
          {t('dismiss')}
        </Button>
        <Button variant="destructive" size="md" block onClick={() => setRemoving(true)} disabled={busy}>
          <Trash2 className="w-4 h-4" aria-hidden="true" />
          {t('removeContent')}
        </Button>
      </div>
      {removing && (
        <ReasonSheet
          title="removeContentTitle"
          confirmLabel="removeContent"
          onConfirm={async (reason) => {
            await resolve(group.key, true, reason);
            showToast(t('contentRemovedToast'), 'success');
          }}
          onClose={() => setRemoving(false)}
        />
      )}
    </section>
  );
}
