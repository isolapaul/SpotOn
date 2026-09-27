'use client';

import { CheckCircle } from 'lucide-react';
import { useT } from '@/hooks/useT';
import type { SpotEdit } from './useSpotEdit';

interface EditFormProps {
  edit: SpotEdit;
}

/** Description editor with Save/Cancel; shown in place of the description while editing. */
export default function EditForm({ edit }: Readonly<EditFormProps>) {
  const t = useT();
  return (
    <div>
      <h2 className="text-xl font-bold text-white mb-3">{t('editDescription')}</h2>
      <textarea
        value={edit.editDescription}
        onChange={(e) => edit.setEditDescription(e.target.value)}
        maxLength={2000}
        className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all resize-none"
        rows={4}
      />
      <div className="flex gap-2 mt-3">
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
