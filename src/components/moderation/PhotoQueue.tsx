'use client';

import Image from 'next/image';
import { useModerationStore } from '@/store/useModerationStore';
import { usePublicProfile } from '@/hooks/usePublicProfile';
import { useT } from '@/hooks/useT';
import type { PhotoSubmission } from '@/lib/moderation';
import QueueCard from './QueueCard';
import QueueEmpty from './QueueEmpty';

function Uploader({ uid }: Readonly<{ uid: string }>) {
  const t = useT();
  const profile = usePublicProfile(uid);
  return <p className="text-[13px] text-label-tertiary">{t('photoBy', { name: profile?.username ?? '…' })}</p>;
}

/** Admin: photos other users added to spots, shown large, approved or rejected with a reason. */
export default function PhotoQueue({ photos }: Readonly<{ photos: PhotoSubmission[] }>) {
  const reviewPhoto = useModerationStore((s) => s.reviewPhoto);
  const t = useT();

  if (photos.length === 0) return <QueueEmpty text={t('noPendingPhotos')} />;
  return (
    <div className="space-y-3">
      {photos.map((photo) => (
        <QueueCard
          key={photo.id}
          label={photo.spotName}
          rejectTitle="rejectPhotoTitle"
          onApprove={() => reviewPhoto(photo.id, true)}
          onReject={(reason) => reviewPhoto(photo.id, false, reason)}
          approvedToast="photoApprovedToast"
          rejectedToast="photoRejectedToast"
        >
          <span className="relative block w-full aspect-[4/3] rounded-[14px] overflow-hidden bg-surface-3">
            <Image src={photo.url} alt={photo.spotName} fill sizes="(max-width: 640px) 100vw, 480px" unoptimized className="object-cover" />
          </span>
          <div>
            <p className="text-label font-semibold line-clamp-1">{photo.spotName}</p>
            <Uploader uid={photo.uploader} />
          </div>
        </QueueCard>
      ))}
    </div>
  );
}
