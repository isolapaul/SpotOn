'use client';

import { CloseButton } from '@/components/ui/Button';
import CategoryIcon from '@/components/ui/CategoryIcon';
import { useUserStore } from '@/store/useUserStore';
import { useUploadStore } from '@/store/useUploadStore';
import { useT } from '@/hooks/useT';
import { X, MapPin, Upload } from 'lucide-react';
import { useState, useRef, ChangeEvent } from 'react';
import Image from 'next/image';
import type { SpotCategory } from '@/store/useSpotStore';
import { MAX_SPOT_IMAGES, MAX_UPLOAD_BYTES } from '@/lib/constants';
import { CATEGORIES } from '@/lib/categories';
import ModalShell, { SAFE_AREA_MARGINS } from './ui/ModalShell';

interface AddSpotModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedLocation: { lat: number; lng: number } | null;
}

export default function AddSpotModal({ isOpen, onClose, selectedLocation }: Readonly<AddSpotModalProps>) {
  const { user } = useUserStore();
  const isAdmin = useUserStore((s) => s.isAdmin);
  const submitSpot = useUploadStore((st) => st.submitSpot);
  const t = useT();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: '',
    category: 'scenic' as SpotCategory,
    description: '',
  });
  const [imageFiles, setImageFiles] = useState<File[]>([]); // Changed to array
  const [imagePreviews, setImagePreviews] = useState<string[]>([]); // Changed to array
  const [primaryImageIndex, setPrimaryImageIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  // Swipe-to-dismiss intentionally disabled to prevent accidental dismissal on iOS

  if (!isOpen) return null;

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Check if adding these files would exceed the image limit
    if (imageFiles.length + files.length > MAX_SPOT_IMAGES) {
      setError(t('maxSpotImages'));
      return;
    }

    // Check each file size
    const validFiles: File[] = [];
    const previews: string[] = [];

    for (const file of files) {
      if (file.size > MAX_UPLOAD_BYTES) {
        setError(t('imageTooLarge'));
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length === 0) return;

    // Create previews for valid files
    validFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        previews.push(reader.result as string);
        if (previews.length === validFiles.length) {
          setImageFiles((prev) => [...prev, ...validFiles]);
          setImagePreviews((prev) => [...prev, ...previews]);
          setError(null);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveImage = (index: number) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
    
    // Adjust primary image index if needed
    if (index === primaryImageIndex) {
      setPrimaryImageIndex(0);
    } else if (index < primaryImageIndex) {
      setPrimaryImageIndex((prev) => prev - 1);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      setError(t('mustBeLoggedIn'));
      return;
    }

    if (!selectedLocation) {
      setError(t('pleaseSelectLocation'));
      return;
    }

    if (!formData.name.trim()) {
      setError(t('pleaseEnterName'));
      return;
    }

    // Runs in the background (G4): the form closes at once; UploadStatus and the notification
    // center report the result, and the spot shows on the map once it is fully uploaded.
    submitSpot({
      fields: {
        name: formData.name.trim(),
        category: formData.category,
        description: formData.description.trim(),
        location: selectedLocation,
        createdBy: user.uid,
        createdByName: user.username,
        createdByPhoto: user.photoURL,
      },
      files: imageFiles,
      primaryIndex: primaryImageIndex,
      userId: user.uid,
      isAdmin, // Admins' spots are approved immediately
    });
    handleClose();
  };

  const handleClose = () => {
    setFormData({ name: '', category: 'scenic', description: '' });
    setImageFiles([]);
    setImagePreviews([]);
    setPrimaryImageIndex(0);
    setError(null);
    onClose();
  };

  // Swipe-to-dismiss intentionally disabled to prevent accidental dismissal on iOS

  return (
    <ModalShell
      variant="glass"
      z="panel"
      onBackdropClick={handleClose}
      backdropLabel="Close add spot modal"
      panelClassName="max-w-lg w-full max-h-[90vh] overflow-y-auto custom-scrollbar p-6"
      panelStyle={SAFE_AREA_MARGINS}
    >
        
        {/* Close Button */}
        <CloseButton label="Close" onClick={handleClose} className="absolute top-3 right-3" />

        {/* Title */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-[16px] grid place-items-center bg-brand-500/15">
            <MapPin className="w-6 h-6 text-brand-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">{t('addNewSpot')}</h2>
            <p className="text-white/60 text-sm">{t('shareLocation')}</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Location Display */}
          {selectedLocation && (
            <div className="glass p-3 rounded-xl">
              <p className="text-white/80 text-sm flex items-center gap-1.5">
                <MapPin className="w-4 h-4 flex-shrink-0 text-brand-400" aria-hidden="true" />
                {t('location')}: {selectedLocation.lat.toFixed(6)}, {selectedLocation.lng.toFixed(6)}
              </p>
            </div>
          )}

          {/* Name Input */}
          <div>
            <label htmlFor="spot-name" className="block text-white font-medium mb-2">
              {t('spotName')} *
            </label>
            <input
              id="spot-name"
              name="spotName"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              maxLength={100}
              placeholder={t('spotNamePlaceholder')}
              className="w-full px-4 py-3 rounded-xl glass text-white placeholder-white/40
                border border-white/10 focus:border-white/30 focus:outline-none
                transition-all duration-200"
              required
            />
          </div>

          {/* Category: a grid of glyph tiles (design phase 3) */}
          <div>
            <p id="spot-category-label" className="block text-white font-medium mb-2">
              {t('category')} *
            </p>
            <div role="radiogroup" aria-labelledby="spot-category-label" className="grid grid-cols-3 gap-2">
              {CATEGORIES.map((c) => {
                const selected = formData.category === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setFormData({ ...formData, category: c.id })}
                    className={`no-min-size h-[72px] rounded-[14px] flex flex-col items-center justify-center gap-1.5 px-1 text-[12px] font-semibold
                      touch-manipulation transition-colors duration-200 active:scale-95 ${
                        selected ? 'bg-brand-600 text-white' : 'bg-white/[.06] text-label-secondary'
                      }`}
                  >
                    <CategoryIcon category={c.id} className={`w-6 h-6 ${selected ? 'motion-safe:animate-badge-pop' : ''}`} />
                    <span className="leading-tight text-center line-clamp-2">{t(c.labelKey)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="spot-description" className="block text-white font-medium mb-2">
              {t('description')}
            </label>
            <textarea
              id="spot-description"
              name="spotDescription"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              maxLength={2000}
              placeholder={t('descriptionPlaceholder')}
              rows={3}
              className="w-full px-4 py-3 rounded-xl glass text-white placeholder-white/40
                border border-white/10 focus:border-white/30 focus:outline-none
                transition-all duration-200 resize-none"
            />
          </div>

          {/* Image Upload */}
          <div>
            <label htmlFor="spot-image" className="block text-white font-medium mb-2">
              {t('photoOptional')} <span className="text-white/60 text-sm">({imageFiles.length}/{MAX_SPOT_IMAGES})</span>
            </label>
            <input
              id="spot-image"
              name="spotImage"
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageChange}
              className="hidden"
            />
            
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={imageFiles.length >= MAX_SPOT_IMAGES}
              className="w-full py-8 rounded-xl glass border-2 border-dashed border-white/20
                hover:border-white/40 hover:bg-white/5
                transition-all duration-200 flex flex-col items-center gap-2
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Upload className="w-8 h-8 text-white/60" />
              <span className="text-white/80 font-medium">{t('clickToUpload')}</span>
              <span className="text-white/40 text-xs">{t('maxSize')} • {t('maxImagesShort', { max: MAX_SPOT_IMAGES })}</span>
            </button>
            
            {/* Image Previews Grid */}
            {imagePreviews.length > 0 && (
              <div className="mt-4 grid grid-cols-3 gap-2">
                {imagePreviews.map((preview, index) => (
                  <div
                    key={`preview-${index}-${preview.substring(0, 20)}`}
                    className={`relative aspect-square rounded-lg overflow-hidden border-2 ${
                      index === primaryImageIndex ? 'border-primary-500' : 'border-white/20'
                    }`}
                  >
                    {/* A local data: URL preview: nothing to optimise */}
                    <Image
                      src={preview}
                      alt={`Preview ${index + 1}`}
                      fill
                      unoptimized
                      sizes="33vw"
                      className="object-cover"
                    />
                    {/* Primary badge */}
                    {index === primaryImageIndex && (
                      <div className="absolute top-1 left-1 bg-primary-500 text-white text-xs px-2 py-1 rounded">
                        {t('primaryBadge')}
                      </div>
                    )}
                    {/* Remove button */}
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(index)}
                      className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white p-1 rounded-full transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    {/* Set as primary button */}
                    {index !== primaryImageIndex && (
                      <button
                        type="button"
                        onClick={() => setPrimaryImageIndex(index)}
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

          {/* Error Message */}
          {error && (
            <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/30">
              <p className="text-red-200 text-sm">{error}</p>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!selectedLocation || !formData.name.trim()}
            className="w-full h-[50px] rounded-full font-semibold text-[17px]
              bg-brand-600 text-white active:bg-brand-700
              active:scale-[.98] transition-all duration-150
              disabled:opacity-40 disabled:cursor-not-allowed
              flex items-center justify-center gap-2"
          >
            <MapPin className="w-5 h-5" />
            <span>{t('submitSpot')}</span>
          </button>

          <p className="text-white/50 text-xs text-center">
            {t('reviewMessage')}
          </p>
        </form>
    </ModalShell>
  );
}
