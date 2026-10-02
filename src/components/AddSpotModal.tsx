'use client';

import { CloseButton } from '@/components/ui/Button';
import { useUserStore } from '@/store/useUserStore';
import { useUploadStore } from '@/store/useUploadStore';
import { useT } from '@/hooks/useT';
import { MapPin } from 'lucide-react';
import ModalShell, { SAFE_AREA_MARGINS } from './ui/ModalShell';
import CategoryPicker from './add-spot/CategoryPicker';
import PhotoPicker from './add-spot/PhotoPicker';
import { useSpotDraft } from './add-spot/useSpotDraft';

interface AddSpotModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedLocation: { lat: number; lng: number } | null;
}

const INPUT_CLASS = `w-full px-4 py-3 rounded-xl glass text-white placeholder-white/40
  border border-white/10 focus:border-white/30 focus:outline-hidden transition-all duration-200`;

// Swipe-to-dismiss intentionally disabled to prevent accidental dismissal on iOS
export default function AddSpotModal({ isOpen, onClose, selectedLocation }: Readonly<AddSpotModalProps>) {
  const { user } = useUserStore();
  const isAdmin = useUserStore((s) => s.isAdmin);
  const submitSpot = useUploadStore((st) => st.submitSpot);
  const t = useT();
  const draft = useSpotDraft();
  const { fields, setField, error } = draft;

  if (!isOpen) return null;

  const handleClose = () => {
    draft.reset();
    onClose();
  };

  const handleSubmit = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return draft.setError('mustBeLoggedIn');
    if (!selectedLocation) return draft.setError('pleaseSelectLocation');
    if (!fields.name.trim()) return draft.setError('pleaseEnterName');

    // Runs in the background (G4): the form closes at once; UploadStatus and the notification
    // center report the result, and the spot shows on the map once it is fully uploaded.
    submitSpot({
      fields: {
        name: fields.name.trim(),
        category: fields.category,
        description: fields.description.trim(),
        location: selectedLocation,
        createdBy: user.uid,
        createdByName: user.username,
        createdByPhoto: user.photoURL,
      },
      files: draft.images,
      primaryIndex: draft.primaryIndex,
      userId: user.uid,
      isAdmin, // Admins' spots are approved immediately
    });
    handleClose();
  };

  return (
    <ModalShell
      variant="glass"
      z="panel"
      onBackdropClick={handleClose}
      backdropLabel="Close add spot modal"
      panelClassName="max-w-lg w-full max-h-[90vh] overflow-y-auto custom-scrollbar p-6"
      panelStyle={SAFE_AREA_MARGINS}
    >
      <CloseButton label="Close" onClick={handleClose} className="absolute top-3 right-3" />

      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-[16px] grid place-items-center bg-brand-500/15">
          <MapPin className="w-6 h-6 text-brand-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white">{t('addNewSpot')}</h2>
          <p className="text-white/60 text-sm">{t('shareLocation')}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {selectedLocation && (
          <div className="glass p-3 rounded-xl">
            <p className="text-white/80 text-sm flex items-center gap-1.5">
              <MapPin className="w-4 h-4 shrink-0 text-brand-400" aria-hidden="true" />
              {t('location')}: {selectedLocation.lat.toFixed(6)}, {selectedLocation.lng.toFixed(6)}
            </p>
          </div>
        )}

        <div>
          <label htmlFor="spot-name" className="block text-white font-medium mb-2">
            {t('spotName')} *
          </label>
          <input
            id="spot-name"
            name="spotName"
            type="text"
            value={fields.name}
            onChange={(e) => setField('name', e.target.value)}
            maxLength={100}
            placeholder={t('spotNamePlaceholder')}
            className={INPUT_CLASS}
            required
          />
        </div>

        <CategoryPicker value={fields.category} onChange={(c) => setField('category', c)} />

        <div>
          <label htmlFor="spot-description" className="block text-white font-medium mb-2">
            {t('description')}
          </label>
          <textarea
            id="spot-description"
            name="spotDescription"
            value={fields.description}
            onChange={(e) => setField('description', e.target.value)}
            maxLength={2000}
            placeholder={t('descriptionPlaceholder')}
            rows={3}
            className={`${INPUT_CLASS} resize-none`}
          />
        </div>

        <PhotoPicker
          previews={draft.previews}
          primaryIndex={draft.primaryIndex}
          onPick={(e) => void draft.addImages(e)}
          onRemove={draft.removeImage}
          onMakePrimary={draft.setPrimaryIndex}
        />

        {error && (
          <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/30">
            <p className="text-red-200 text-sm">{t(error)}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={!selectedLocation || !fields.name.trim()}
          className="w-full h-[50px] rounded-full font-semibold text-[17px]
            bg-brand-600 text-white active:bg-brand-700
            active:scale-[.98] transition-all duration-150
            disabled:opacity-40 disabled:cursor-not-allowed
            flex items-center justify-center gap-2"
        >
          <MapPin className="w-5 h-5" />
          <span>{t('submitSpot')}</span>
        </button>

        <p className="text-white/50 text-xs text-center">{t('reviewMessage')}</p>
      </form>
    </ModalShell>
  );
}
