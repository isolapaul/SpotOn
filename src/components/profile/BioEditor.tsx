'use client';

import { useState } from 'react';
import { useUserStore } from '@/store/useUserStore';
import { useToastStore } from '@/store/useToastStore';
import { useT } from '@/hooks/useT';

export const BIO_MAX = 150;

/** The own bio (item 8): shown under the name; tap to write or change it (up to BIO_MAX). */
export default function BioEditor({ bio }: Readonly<{ bio?: string }>) {
  const t = useT();
  const updateProfileFields = useUserStore((s) => s.updateProfileFields);
  const showToast = useToastStore((s) => s.showToast);
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (draft === null) return;
    setSaving(true);
    try {
      await updateProfileFields({ bio: draft });
      setDraft(null);
    } catch (error) {
      console.error('Bio update failed:', error);
      showToast(t('genericError'), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (draft === null) {
    return (
      <button
        type="button"
        onClick={() => setDraft(bio ?? '')}
        className={`no-min-size max-w-sm mb-3 text-[15px] whitespace-pre-line wrap-break-word text-center ${bio ? 'text-label-secondary' : 'text-brand-400 font-medium'}`}
      >
        {bio || t('addBio')}
      </button>
    );
  }
  return (
    <div className="w-full max-w-md mb-3 motion-safe:animate-fade-in">
      <textarea
        aria-label={t('bio')}
        value={draft}
        maxLength={BIO_MAX}
        rows={3}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        placeholder={t('bioPlaceholder')}
        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/40 focus:outline-hidden focus:border-white/30 resize-none"
      />
      <div className="mt-2 flex items-center gap-2">
        <span className="flex-1 text-xs text-label-tertiary tabular-nums">{draft.length} / {BIO_MAX}</span>
        <button type="button" onClick={() => setDraft(null)} className="px-4 py-2 rounded-lg bg-white/6 text-white text-sm">
          {t('cancel')}
        </button>
        <button type="button" onClick={save} disabled={saving} className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-semibold disabled:opacity-60">
          {saving ? t('saving') : t('save')}
        </button>
      </div>
    </div>
  );
}
