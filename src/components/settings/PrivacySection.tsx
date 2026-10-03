'use client';

import { useState } from 'react';
import { Lock } from 'lucide-react';
import { useUserStore, type User } from '@/store/useUserStore';
import { useToastStore } from '@/store/useToastStore';
import { useT } from '@/hooks/useT';
import type { TranslationKey } from '@/lib/translations';

type Field = 'profilePrivate' | 'showSaved';

const ROWS: readonly { field: Field; title: TranslationKey; desc: TranslationKey }[] = [
  { field: 'profilePrivate', title: 'privateProfile', desc: 'privateProfileDesc' },
  { field: 'showSaved', title: 'showSavedSpots', desc: 'showSavedSpotsDesc' },
];

/** Profile visibility (item 8): private profile, saved spots on the profile. Default: public, hidden. */
export default function PrivacySection({ user }: Readonly<{ user: User }>) {
  const t = useT();
  const updateProfileFields = useUserStore((s) => s.updateProfileFields);
  const showToast = useToastStore((s) => s.showToast);
  const [saving, setSaving] = useState<Field | null>(null);

  const toggle = async (field: Field) => {
    setSaving(field);
    try {
      await updateProfileFields({ [field]: user[field] !== true });
    } catch (error) {
      console.error('Privacy update failed:', error);
      showToast(t('genericError'), 'error');
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="rounded-[18px] bg-surface-1 p-5">
      <h3 className="text-[13px] font-semibold uppercase tracking-wide text-label-tertiary mb-3 flex items-center gap-2">
        <Lock className="w-5 h-5" />
        {t('privacyHeader')}
      </h3>
      <div className="divide-y divide-white/[.06]">
        {ROWS.map(({ field, title, desc }) => {
          const on = user[field] === true;
          return (
            <div key={field} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
              <div className="flex-1 min-w-0">
                <p className="text-label text-[15px] font-medium">{t(title)}</p>
                <p className="text-label-secondary text-xs mt-0.5">{t(desc)}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-label={t(title)}
                disabled={saving !== null}
                onClick={() => toggle(field)}
                className={`no-min-size relative w-[51px] h-[31px] rounded-full flex-shrink-0 transition-colors duration-200 disabled:opacity-60 ${on ? 'bg-brand-600' : 'bg-white/15'}`}
              >
                <span className={`absolute top-[2px] left-[2px] w-[27px] h-[27px] rounded-full bg-white shadow transition-transform duration-200 ease-ios ${on ? 'translate-x-5' : ''}`} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
