'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Star, Trash2, Image as ImageIcon, Images } from 'lucide-react';
import { useSpotStore, type Spot } from '@/store/useSpotStore';
import { useModerationStore } from '@/store/useModerationStore';
import { useToastStore } from '@/store/useToastStore';
import { useT } from '@/hooks/useT';
import { PLACEHOLDER_URL, getSpotImages } from '@/lib/spotImages';

interface ImageManagerProps {
  spot: Spot;
  /** Number of gallery images, shown on the toggle. */
  imageCount: number;
  /** direct: admins, the owner of a spot under review; propose: the owner of an approved spot (item 4). */
  route: 'direct' | 'propose';
}

/** A manager tile: `index` is the image's position in imageUrls (what primaryImageIndex indexes). */
type ManagedImage = { url: string; index?: number };

// Manager tiles (T21, BUG-03): imageUrls entries keep their original index (primaryImageIndex
// indexes imageUrls); images only in spotImages have no index, so they can be deleted but not made primary.
function getManagedImages(spot: Spot): ManagedImage[] {
  const imageUrlSet = new Set(spot.imageUrls || []);
  return [
    ...(spot.imageUrls || []).map((url, index) => ({ url, index })).filter((e) => e.url !== PLACEHOLDER_URL),
    ...getSpotImages(spot)
      .map((img) => img.url)
      .filter((url, i, self) => url !== PLACEHOLDER_URL && !imageUrlSet.has(url) && self.indexOf(url) === i)
      .map((url) => ({ url })),
  ];
}

/**
 * "Manage images" (owner/admin): toggle, then set-primary and delete per image. On an approved spot
 * the owner's changes are proposed for review instead of applied (item 4).
 */
export default function ImageManager({ spot, imageCount, route }: Readonly<ImageManagerProps>) {
  const setPrimaryImage = useSpotStore((s) => s.setPrimaryImage);
  const deleteSpotImage = useSpotStore((s) => s.deleteSpotImage);
  const proposeEdit = useModerationStore((s) => s.proposeEdit);
  const showToast = useToastStore((s) => s.showToast);
  const t = useT();
  const [showManageImages, setShowManageImages] = useState(false);

  const handleSetPrimaryImage = async (index: number) => {
    try {
      if (route === 'propose') {
        const url = spot.imageUrls?.[index];
        if (url && (await proposeEdit(spot, { primaryImageUrl: url }))) showToast(t('editSentForReview'), 'success');
        return;
      }
      await setPrimaryImage(spot.id, index);
      showToast(t('primaryImageSet'), 'success');
    } catch {
      showToast(t('updateError'), 'error');
    }
  };

  const handleDeleteImage = async (imageUrl: string) => {
    if (!confirm(t('confirmDeleteImage'))) return;
    try {
      if (route === 'propose') {
        if (await proposeEdit(spot, { removeImageUrls: [imageUrl] })) showToast(t('editSentForReview'), 'success');
        return;
      }
      await deleteSpotImage(spot.id, imageUrl);
      showToast(t('imageDeleted'), 'success');
    } catch {
      showToast(t('updateError'), 'error');
    }
  };

  return (
    <div>
      <button
        onClick={() => setShowManageImages(!showManageImages)}
        className="w-full rounded-[18px] bg-surface-1 p-4 flex items-center justify-between hover:bg-white/10 transition-colors"
      >
        <div className="flex items-center gap-2">
          <ImageIcon className="w-5 h-5 text-primary-400" />
          <span className="text-white font-medium">{t('manageImages')}</span>
        </div>
        <span className="text-white/40 text-sm inline-flex items-center gap-1">{imageCount} <Images className="w-4 h-4" aria-hidden="true" /></span>
      </button>
      {showManageImages && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {getManagedImages(spot).map(({ url, index }, position) => (
            <div key={url} className="relative group rounded-xl overflow-hidden aspect-square">
              <Image src={url} alt={`Image ${position + 1}`} fill sizes="120px" className="object-cover" />
              {index !== undefined && (spot.primaryImageIndex || 0) === index && (
                <div className="absolute top-1 left-1 bg-primary-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">★</div>
              )}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                {index !== undefined && (
                  <button onClick={() => handleSetPrimaryImage(index)} className="p-1.5 rounded-full bg-primary-500/80 text-white hover:bg-primary-500 transition-colors" title={t('setPrimaryImage')}>
                    <Star className="w-3.5 h-3.5" />
                  </button>
                )}
                <button onClick={() => handleDeleteImage(url)} className="p-1.5 rounded-full bg-red-500/80 text-white hover:bg-red-500 transition-colors" title={t('deleteImage')}>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
