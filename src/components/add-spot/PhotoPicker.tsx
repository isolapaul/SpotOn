'use client';

import { useRef, type ChangeEvent } from 'react';
import Image from 'next/image';
import { Upload, X } from 'lucide-react';
import { useT } from '@/hooks/useT';
import { MAX_SPOT_IMAGES } from '@/lib/constants';

interface PhotoPickerProps {
  previews: readonly string[];
  primaryIndex: number;
  onPick: (e: ChangeEvent<HTMLInputElement>) => void;
  onRemove: (index: number) => void;
  onMakePrimary: (index: number) => void;
}

/** Photo picking for a new spot: the upload tile and the preview grid with primary/remove controls. */
export default function PhotoPicker({ previews, primaryIndex, onPick, onRemove, onMakePrimary }: Readonly<PhotoPickerProps>) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      <label htmlFor="spot-image" className="block text-white font-medium mb-2">
        {t('photoOptional')} <span className="text-white/60 text-sm">({previews.length}/{MAX_SPOT_IMAGES})</span>
      </label>
      <input
        id="spot-image"
        name="spotImage"
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={onPick}
        className="hidden"
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={previews.length >= MAX_SPOT_IMAGES}
        className="w-full py-8 rounded-xl glass border-2 border-dashed border-white/20
          hover:border-white/40 hover:bg-white/5
          transition-all duration-200 flex flex-col items-center gap-2
          disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Upload className="w-8 h-8 text-white/60" />
        <span className="text-white/80 font-medium">{t('clickToUpload')}</span>
        <span className="text-white/40 text-xs">{t('maxSize')} • {t('maxImagesShort', { max: MAX_SPOT_IMAGES })}</span>
      </button>

      {previews.length > 0 && (
        <div className="mt-4 grid grid-cols-3 gap-2">
          {previews.map((preview, index) => (
            <div
              key={`preview-${index}-${preview.substring(0, 20)}`}
              className={`relative aspect-square rounded-lg overflow-hidden border-2 ${
                index === primaryIndex ? 'border-primary-500' : 'border-white/20'
              }`}
            >
              {/* A local data: URL preview: nothing to optimise */}
              <Image src={preview} alt={`Preview ${index + 1}`} fill unoptimized sizes="33vw" className="object-cover" />
              {index === primaryIndex && (
                <div className="absolute top-1 left-1 bg-primary-500 text-white text-xs px-2 py-1 rounded">
                  {t('primaryBadge')}
                </div>
              )}
              <button
                type="button"
                onClick={() => onRemove(index)}
                className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white p-1 rounded-full transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              {index !== primaryIndex && (
                <button
                  type="button"
                  onClick={() => onMakePrimary(index)}
                  className="absolute bottom-1 left-1 right-1 bg-black/60 hover:bg-black/80 text-white text-xs py-1 rounded transition-colors"
                >
                  {t('makePrimary')}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
