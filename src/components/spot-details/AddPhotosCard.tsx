'use client';

import { useRef, useState, type ChangeEvent } from 'react';
import { ImagePlus } from 'lucide-react';
import { useSpotStore, type Spot } from '@/store/useSpotStore';
import { useUserStore } from '@/store/useUserStore';
import { useToastStore } from '@/store/useToastStore';
import { useT } from '@/hooks/useT';

interface AddPhotosCardProps {
  spotId: Spot['id'];
}

/** "Add photos" card: a hidden multi-file input uploading to the spot (T11b/T22 semantics). */
export default function AddPhotosCard({ spotId }: Readonly<AddPhotosCardProps>) {
  const user = useUserStore((s) => s.user);
  const addSpotImages = useSpotStore((s) => s.addSpotImages);
  const showToast = useToastStore((s) => s.showToast);
  const t = useT();
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const handleAddPhotos = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    if (!user) { showToast(t('mustBeLoggedIn'), 'error'); event.target.value = ''; return; }

    setIsUploadingPhotos(true);
    try {
      await addSpotImages(spotId, files, user.uid);
      showToast(t('spotPhotosAdded'), 'success');
    } catch (error) {
      console.error('Failed to add photos:', error);
      showToast(error instanceof Error && error.message === 'MAX_SPOT_IMAGES' ? t('maxSpotImages') : t('spotPhotoAddError'), 'error');
    } finally {
      setIsUploadingPhotos(false);
      event.target.value = '';
    }
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
          disabled={isUploadingPhotos}
          className="px-4 py-2 rounded-xl font-medium text-sm bg-white/10 text-white border border-white/20 hover:bg-white/20 active:scale-98 transition-all disabled:opacity-50 flex items-center gap-2"
        >
          <ImagePlus className="w-4 h-4" />
          {isUploadingPhotos ? t('uploadingPhotos') : t('addPhotos')}
        </button>
      </div>
      <input ref={photoInputRef} type="file" accept="image/*" multiple onChange={handleAddPhotos} className="hidden" />
    </div>
  );
}
