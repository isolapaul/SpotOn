'use client';

import { useUserStore } from '@/store/useUserStore';
import { useSpotStore } from '@/store/useSpotStore';
import { useToastStore } from '@/store/useToastStore';
import { X, MapPin, Upload, Loader2 } from 'lucide-react';
import { useState, useRef, ChangeEvent } from 'react';

interface AddSpotModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedLocation: { lat: number; lng: number } | null;
}

type Category = 'scenic' | 'smoke-spot' | 'viewpoint' | 'other';

export default function AddSpotModal({ isOpen, onClose, selectedLocation }: Readonly<AddSpotModalProps>) {
  const { user } = useUserStore();
  const { addSpot } = useSpotStore();
  const { showToast } = useToastStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: '',
    category: 'scenic' as Category,
    description: '',
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Image must be less than 5MB');
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
      setError('You must be logged in to add a spot');
      return;
    }

    if (!selectedLocation) {
      setError('Please select a location on the map');
      return;
    }

    if (!imageFile) {
      setError('Please upload an image');
      return;
    }

    if (!formData.name.trim()) {
      setError('Please enter a name for the spot');
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
        },
        imageFile,
        user.uid
      );

      // Reset form and close
      setFormData({ name: '', category: 'scenic', description: '' });
      setImageFile(null);
      setImagePreview(null);
      onClose();
      
      showToast('Spot uploaded! Waiting for approval.', 'success');
    } catch (err) {
      console.error('Error adding spot:', err);
      setError('Failed to add spot. Please try again.');
      showToast('Failed to add spot. Please try again.', 'error');
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

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 animate-fade-in">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className="relative glass-card max-w-lg w-full max-h-[90vh] overflow-y-auto custom-scrollbar p-6 animate-slide-up">
        {/* Close Button */}
        <button
          onClick={handleClose}
          disabled={loading}
          className="absolute top-4 right-4 glass-button p-2 rounded-full disabled:opacity-50"
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
            <h2 className="text-2xl font-bold text-white">Add New Spot</h2>
            <p className="text-white/60 text-sm">Share a scenic location</p>
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
            <label className="block text-white font-medium mb-2">
              Spot Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Sunset Point"
              className="w-full px-4 py-3 rounded-xl glass text-white placeholder-white/40
                border border-white/10 focus:border-white/30 focus:outline-none
                transition-all duration-200"
              disabled={loading}
              required
            />
          </div>

          {/* Category Select */}
          <div>
            <label className="block text-white font-medium mb-2">
              Category *
            </label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value as Category })}
              className="w-full px-4 py-3 rounded-xl glass text-white
                border border-white/10 focus:border-white/30 focus:outline-none
                transition-all duration-200 bg-transparent"
              disabled={loading}
              required
            >
              <option value="scenic" className="bg-gray-800">🌅 Scenic View</option>
              <option value="smoke-spot" className="bg-gray-800">💨 Smoke Spot</option>
              <option value="viewpoint" className="bg-gray-800">🏔️ Viewpoint</option>
              <option value="other" className="bg-gray-800">📍 Other</option>
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-white font-medium mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe what makes this spot special..."
              rows={3}
              className="w-full px-4 py-3 rounded-xl glass text-white placeholder-white/40
                border border-white/10 focus:border-white/30 focus:outline-none
                transition-all duration-200 resize-none"
              disabled={loading}
            />
          </div>

          {/* Image Upload */}
          <div>
            <label className="block text-white font-medium mb-2">
              Photo *
            </label>
            <input
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
                <span className="text-white/80 font-medium">Click to upload image</span>
                <span className="text-white/40 text-xs">Max 5MB</span>
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
            disabled={loading || !selectedLocation || !imageFile || !formData.name.trim()}
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
                <span>Compressing & Uploading...</span>
              </>
            ) : (
              <>
                <MapPin className="w-5 h-5" />
                <span>Submit Spot</span>
              </>
            )}
          </button>

          <p className="text-white/50 text-xs text-center">
            Your spot will be reviewed before appearing on the map
          </p>
        </form>
      </div>
    </div>
  );
}
