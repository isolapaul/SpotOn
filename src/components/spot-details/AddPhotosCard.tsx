'use client';

import { useRef, type ChangeEvent } from 'react';
import { ImagePlus } from 'lucide-react';
import type { Spot } from '@/store/useSpotStore';
import { useUserStore } from '@/store/useUserStore';
import { useToastStore } from '@/store/useToastStore';
import { isSpotUploadRunning, useUploadStore } from '@/store/useUploadStore';
import { useT } from '@/hooks/useT';
import { MAX_SPOT_IMAGES, realImageCount } from '@/lib/spotImages';

interface AddPhotosCardProps {
  spot: Spot;
}

/** "Add photos" card: photo-only uploads to the spot, run in the background (G4). */
export default function AddPhotosCard({ spot }: Readonly<AddPhotosCardProps>) {
  const user = useUserStore((s) => s.user);
  const submitPhotos = useUploadStore((s) => s.submitPhotos);
  const isUploading = useUploadStore((s) => isSpotUploadRunning(s.jobs, spot.id));
  const showToast = useToastStore((s) => s.showToast);
  const t = useT();
  const photoInputRef = useRef<HTMLInputElement>(null);

  const handleAddPhotos = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;
    if (!user) { showToast(t('mustBeLoggedIn'), 'error'); return; }
    // Same limit the server enforces (resource-exhausted), checked before anything is uploaded.
    if (realImageCount(spot) + files.length > MAX_SPOT_IMAGES) { showToast(t('maxSpotImages'), 'error'); return; }
    submitPhotos({ spotId: spot.id, spotName: spot.name, files, userId: user.uid });
  };

  return (
    <div className="glass-card p-4 mb-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-white font-medium">{t('addSpotPhotos')}</p>
          <p className="text-white/50 text-xs">{t('maxSpotImages')}</p>
        </div>
        <button
          type="button"
          onClick={() => photoInputRef.current?.click()}
          disabled={isUploading}
          className="px-4 py-2 rounded-xl font-medium text-sm bg-white/10 text-white border border-white/20 hover:bg-white/20 active:scale-98 transition-all disabled:opacity-50 flex items-center gap-2"
        >
          <ImagePlus className="w-4 h-4 flex-shrink-0" />
          {isUploading ? t('uploadingPhotos') : t('addPhotos')}
        </button>
      </div>
      <input id="spot-photos-input" ref={photoInputRef} type="file" accept="image/*" multiple onChange={handleAddPhotos} className="hidden" />
    </div>
  );
}
