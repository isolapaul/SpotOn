'use client';

import { useUserStore } from '@/store/useUserStore';
import { useSpotStore } from '@/store/useSpotStore';
import { useToastStore } from '@/store/useToastStore';
import { useLanguageStore } from '@/store/useLanguageStore';
import { X, MapPin, Upload, Loader2 } from 'lucide-react';
import { useState, useRef, ChangeEvent } from 'react';
import type { SpotCategory } from '@/store/useSpotStore';

interface AddSpotModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedLocation: { lat: number; lng: number } | null;
}

export default function AddSpotModal({ isOpen, onClose, selectedLocation }: Readonly<AddSpotModalProps>) {
  const { user } = useUserStore();
  const { addSpot } = useSpotStore();
  const { showToast } = useToastStore();
  const { t } = useLanguageStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: '',
    category: 'scenic' as SpotCategory,
    description: '',
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // PHASE 4: iOS Swipe to Dismiss
  const [dragStartY, setDragStartY] = useState(0);
  const [dragCurrentY, setDragCurrentY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  if (!isOpen) return null;

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError(t('imageTooLarge'));
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
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

    setLoading(true);
    setError(null);

    try {
      // Use the store's addSpot method (handles compression & upload)
      await addSpot(
        {
          name: formData.name.trim(),
          category: formData.category,
          description: formData.description.trim(),
          location: selectedLocation,
          createdBy: user.uid,
          createdByName: user.name,
          createdByPhoto: user.photoURL,
        },
        imageFile, // Can be null now
        user.uid,
        user.email // Pass email for admin check
      );
      
      // Reset form and close
      setFormData({ name: '', category: 'scenic', description: '' });
      setImageFile(null);
      setImagePreview(null);
      onClose();
      
      showToast(t('spotUploaded'), 'success');
    } catch (err: any) {
      const errorMessage = err.message || t('spotUploadFailed');
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setFormData({ name: '', category: 'scenic', description: '' });
      setImageFile(null);
      setImagePreview(null);
      setError(null);
      onClose();
    }
  };

  // PHASE 4: Touch Handlers for Swipe to Dismiss
  const handleTouchStart = (e: React.TouchEvent) => {
    setDragStartY(e.touches[0].clientY);
    setDragCurrentY(e.touches[0].clientY);
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - dragStartY;
    
    // Only allow downward drag
    if (diff > 0) {
      setDragCurrentY(currentY);
    }
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    const dragDistance = dragCurrentY - dragStartY;
    
    // Close if dragged more than 100px down
    if (dragDistance > 100) {
      handleClose();
    }
    
    // Reset
    setIsDragging(false);
    setDragStartY(0);
    setDragCurrentY(0);
  };

  const translateY = isDragging ? Math.max(0, dragCurrentY - dragStartY) : 0;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 animate-fade-in" style={{ backgroundColor: 'rgba(15, 23, 42, 0.5)' }}>
      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-xl cursor-default"
        onClick={handleClose}
        onKeyDown={(e) => e.key === 'Escape' && handleClose()}
        aria-label="Close add spot modal"
        tabIndex={-1}
      />
      
      {/* Modal - With Swipe Support */}
      <div 
        className="relative glass-card max-w-lg w-full max-h-[90vh] overflow-y-auto custom-scrollbar p-6 animate-slide-up"
        style={{ 
          marginTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)',
          marginBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)',
          transform: `translateY(${translateY}px)`,
          transition: isDragging ? 'none' : 'transform 0.3s ease-out'
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Grabber Pill - PHASE 4 */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-gray-600/50 rounded-full" />
        
        {/* Close Button */}
        <button
          onClick={handleClose}
          disabled={loading}
          className="absolute top-4 right-4 glass-button p-3 rounded-full disabled:opacity-50 touch-manipulation min-w-[48px] min-h-[48px]"
          aria-label="Close"
        >
          <X className="w-5 h-5 text-white" />
        </button>

        {/* Title */}
        <div className="flex items-center gap-3 mb-6">
          <div className="glass-button p-3 rounded-full">
            <MapPin className="w-6 h-6 text-white" />
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
              <p className="text-white/80 text-sm">
                📍 Location: {selectedLocation.lat.toFixed(6)}, {selectedLocation.lng.toFixed(6)}
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
              placeholder={t('spotNamePlaceholder')}
              className="w-full px-4 py-3 rounded-xl glass text-white placeholder-white/40
                border border-white/10 focus:border-white/30 focus:outline-none
                transition-all duration-200"
              disabled={loading}
              required
            />
          </div>

          {/* Category Select */}
          <div>
            <label htmlFor="spot-category" className="block text-white font-medium mb-2">
              {t('category')} *
            </label>
            <select
              id="spot-category"
              name="spotCategory"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value as SpotCategory })}
              className="w-full px-4 py-3 rounded-xl glass text-white
                border border-white/10 focus:border-white/30 focus:outline-none
                transition-all duration-200 bg-transparent"
              disabled={loading}
              required
            >
              <option value="scenic" className="bg-gray-800">🌅 {t('categoryScenic')}</option>
              <option value="smoke-spot" className="bg-gray-800">💨 {t('categorySmoke')}</option>
              <option value="viewpoint" className="bg-gray-800">🏔️ {t('categoryViewpoint')}</option>
              <option value="hiking" className="bg-gray-800">🥾 {t('categoryHiking')}</option>
              <option value="random" className="bg-gray-800">🎲 {t('categoryRandom')}</option>
              <option value="date-spot" className="bg-gray-800">❤️ {t('categoryDateSpot')}</option>
              <option value="park" className="bg-gray-800">🌳 {t('categoryPark')}</option>
              <option value="other" className="bg-gray-800">📍 {t('categoryOther')}</option>
            </select>
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
              placeholder={t('descriptionPlaceholder')}
              rows={3}
              className="w-full px-4 py-3 rounded-xl glass text-white placeholder-white/40
                border border-white/10 focus:border-white/30 focus:outline-none
                transition-all duration-200 resize-none"
              disabled={loading}
            />
          </div>

          {/* Image Upload */}
          <div>
            <label htmlFor="spot-image" className="block text-white font-medium mb-2">
              {t('photoOptional')}
            </label>
            <input
              id="spot-image"
              name="spotImage"
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="hidden"
              disabled={loading}
            />
            
            {imagePreview ? (
              <div className="relative group">
                <img 
                  src={imagePreview} 
                  alt="Preview" 
                  className="w-full h-48 object-cover rounded-xl"
                />
                <button
                  type="button"
                  onClick={() => {
                    setImageFile(null);
                    setImagePreview(null);
                  }}
                  className="absolute top-2 right-2 glass-button p-2 rounded-full
                    opacity-0 group-hover:opacity-100 transition-opacity"
                  disabled={loading}
                >
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-8 rounded-xl glass border-2 border-dashed border-white/20
                  hover:border-white/40 hover:bg-white/5
                  transition-all duration-200 flex flex-col items-center gap-2"
                disabled={loading}
              >
                <Upload className="w-8 h-8 text-white/60" />
                <span className="text-white/80 font-medium">{t('clickToUpload')}</span>
                <span className="text-white/40 text-xs">{t('maxSize')}</span>
              </button>
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
            disabled={loading || !selectedLocation || !formData.name.trim()}
            className="w-full py-4 rounded-2xl font-semibold text-lg
              bg-gradient-to-r from-primary-500 to-primary-600 text-white
              shadow-lg shadow-primary-500/30 
              hover:shadow-xl hover:shadow-primary-500/40 
              active:scale-98 transition-all duration-200
              disabled:opacity-50 disabled:cursor-not-allowed
              flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>{t('compressing')}</span>
              </>
            ) : (
              <>
                <MapPin className="w-5 h-5" />
                <span>{t('submitSpot')}</span>
              </>
            )}
          </button>

          <p className="text-white/50 text-xs text-center">
            {t('reviewMessage')}
          </p>
        </form>
      </div>
    </div>
  );
}
