'use client';

import { useState } from 'react';
import { MapPin } from 'lucide-react';
import { useUserStore, userErrorKey, type User } from '@/store/useUserStore';
import { useToastStore } from '@/store/useToastStore';
import { useT } from '@/hooks/useT';
import { normalizePinIcon, PIN_GLYPHS, PIN_ICON_IDS, PIN_ICON_LABELS, type PinIconId } from '@/lib/pinGlyphs';
import { PIN_COLORS } from '@/lib/mapMarkers';
import GlyphIcon from '@/components/ui/GlyphIcon';

interface PinIconPickerProps {
  user: User;
}

/** Level 4+: one special icon for the map pins of all own spots, or the category icons (item 6). */
export default function PinIconPicker({ user }: Readonly<PinIconPickerProps>) {
  const updatePinIcon = useUserStore((s) => s.updatePinIcon);
  const showToast = useToastStore((s) => s.showToast);
  const t = useT();
  const [saving, setSaving] = useState(false);
  const current = normalizePinIcon(user.pinIcon);

  const choose = async (icon: PinIconId | null) => {
    if (saving || icon === current) return;
    setSaving(true);
    try {
      await updatePinIcon(icon);
      showToast(icon ? t('pinIconSet', { name: t(PIN_ICON_LABELS[icon]) }) : t('pinIconReset'), 'success');
    } catch (error) {
      showToast(t(userErrorKey(error) ?? 'genericError'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const option = (icon: PinIconId | null) => {
    const selected = icon === current;
    const label = icon ? t(PIN_ICON_LABELS[icon]) : t('pinIconDefault');
    return (
      <button
        key={icon ?? 'category'}
        type="button"
        onClick={() => choose(icon)}
        disabled={saving}
        aria-pressed={selected}
        aria-label={label}
        className={`flex flex-col items-center gap-1.5 rounded-2xl py-3 transition-colors disabled:opacity-60 ${
          selected ? 'bg-white/10 ring-2 ring-white/70' : 'bg-white/5 hover:bg-white/10'
        }`}
      >
        <span
          className="grid place-items-center w-10 h-10 rounded-full text-white ring-2 ring-white"
          style={{ backgroundColor: PIN_COLORS.approved }}
        >
          {icon ? <GlyphIcon glyph={PIN_GLYPHS[icon]} className="w-5 h-5" /> : <MapPin className="w-5 h-5" aria-hidden="true" />}
        </span>
        <span className="text-xs text-white/80">{label}</span>
      </button>
    );
  };

  return (
    <div className="rounded-[18px] bg-surface-1 p-4 space-y-3 animate-fade-in">
      <div>
        <h3 className="text-white font-semibold">{t('pinStyle')}</h3>
        <p className="text-white/60 text-xs mt-0.5">{t('pinStyleHint')}</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {option(null)}
        {PIN_ICON_IDS.map((icon) => option(icon))}
      </div>
    </div>
  );
}
