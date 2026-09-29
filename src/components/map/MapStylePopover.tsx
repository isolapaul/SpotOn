'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { useMapThemeStore, type MapTheme } from '@/store/useMapThemeStore';
import { useT } from '@/hooks/useT';
import type { TranslationKey } from '@/lib/translations';
import { Z } from '@/lib/constants';
import MapStyleThumb from './MapStyleThumb';

const STYLES: ReadonlyArray<{ id: MapTheme; name: TranslationKey }> = [
  { id: 'standard', name: 'themeStandard' },
  { id: 'light', name: 'themeLight' },
  { id: 'silver', name: 'themeSilver' },
  { id: 'dark', name: 'themeDark' },
  { id: 'satellite', name: 'themeSatellite' },
];

/** Exit animation length (Tailwind `animate-sheet-out`). */
const CLOSE_MS = 180;
/** A pick shows its check before the popover closes. */
const PICK_SETTLE_MS = 150;

/** Map style picker growing out of the control stack (design 1C), replacing the old centred modal. */
export default function MapStylePopover({ onClose }: Readonly<{ onClose: () => void }>) {
  const t = useT();
  const theme = useMapThemeStore((s) => s.theme);
  const setTheme = useMapThemeStore((s) => s.setTheme);
  const [closing, setClosing] = useState(false);

  const close = () => {
    if (closing) return;
    setClosing(true);
    setTimeout(onClose, CLOSE_MS);
  };

  const pick = (id: MapTheme) => {
    setTheme(id);
    setTimeout(close, PICK_SETTLE_MS);
  };

  return (
    <div className={`fixed inset-0 ${Z.modal}`}>
      <button
        type="button"
        aria-label={t('close')}
        tabIndex={-1}
        onClick={close}
        className={`absolute inset-0 bg-black/10 cursor-default ${
          closing ? 'motion-safe:animate-backdrop-out' : 'motion-safe:animate-backdrop-in'
        }`}
      />
      <div
        role="group"
        aria-label={t('mapTheme')}
        className={`material-chrome material-chrome-dense absolute w-[240px] rounded-[20px] p-1.5 origin-top-right ${
          closing ? 'motion-safe:animate-sheet-out' : 'motion-safe:animate-sheet-in'
        }`}
        style={{
          top: 'calc(env(safe-area-inset-top) + 8px)',
          right: 'max(12px, calc(env(safe-area-inset-right) + 8px))',
        }}
      >
        <p className="px-3 pt-2 pb-1 text-[13px] font-semibold text-chrome-ink-2">{t('mapTheme')}</p>
        {STYLES.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={theme === s.id}
            onClick={() => pick(s.id)}
            className="no-min-size w-full h-[52px] flex items-center gap-3 px-2 rounded-xl text-left touch-manipulation
              active:bg-black/[.06] chrome-dark:active:bg-white/10"
          >
            <MapStyleThumb theme={s.id} />
            <span className="flex-1 text-[17px] text-chrome-ink">{t(s.name)}</span>
            <Check
              aria-hidden="true"
              strokeWidth={2.5}
              className={`w-5 h-5 text-brand-600 chrome-dark:text-brand-400 transition-[opacity,transform] duration-250 ease-ios-bounce ${
                theme === s.id ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
