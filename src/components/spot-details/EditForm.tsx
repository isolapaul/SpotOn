'use client';

import { CheckCircle, MapPin } from 'lucide-react';
import { useT } from '@/hooks/useT';
import { useMapThemeStore } from '@/store/useMapThemeStore';
import { useUiStore } from '@/store/useUiStore';
import CategoryPicker from '../add-spot/CategoryPicker';
import type { SpotEdit } from './useSpotEdit';

interface EditFormProps {
  spotId: string;
  edit: SpotEdit;
}

/**
 * Description and category editor with Save/Cancel, shown in place of the description while editing
 * (the name is edited in SpotTitle). "Change location" leaves for the map to pick a new spot position
 * (saved on its own, like the other fields: directly, or proposed for review).
 */
export default function EditForm({ spotId, edit }: Readonly<EditFormProps>) {
  const t = useT();
  const startRelocating = useUiStore((s) => s.startRelocating);
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-white mb-3">{t('editDescription')}</h2>
        <textarea
          value={edit.editDescription}
          onChange={(e) => edit.setEditDescription(e.target.value)}
          maxLength={2000}
          className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-hidden focus:ring-2 focus:ring-primary-500 transition-all resize-none"
          rows={4}
        />
      </div>
      <CategoryPicker value={edit.editCategory} onChange={edit.setEditCategory} />
      <button
        type="button"
        onClick={() => startRelocating(spotId, useMapThemeStore.getState().theme)}
        className="no-min-size w-full h-11 rounded-xl bg-white/6 text-label text-[15px] font-medium flex items-center justify-center gap-2 active:scale-[.98] transition-transform"
      >
        <MapPin className="w-4 h-4 text-brand-400" aria-hidden="true" />
        {t('changeLocation')}
      </button>
      <div className="flex gap-2">
        <button onClick={edit.save} className="flex-1 py-2.5 rounded-xl font-medium text-sm bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30 active:scale-98 transition-all flex items-center justify-center gap-2">
          <CheckCircle className="w-4 h-4" /> {t('save')}
        </button>
        <button onClick={edit.cancel} className="flex-1 py-2.5 rounded-xl font-medium text-sm bg-white/10 text-white/70 border border-white/20 hover:bg-white/20 active:scale-98 transition-all">
          {t('cancel')}
        </button>
      </div>
    </div>
  );
}
