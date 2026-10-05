import { useEffect, useRef, useState } from 'react';
import { Check, Globe } from 'lucide-react';
import { useLanguage, useT } from '@/hooks/useT';
import { useLanguageStore } from '@/store/useLanguageStore';
import { LANGUAGES, LANGUAGE_NAMES } from '@/lib/i18n';

/** The welcome step's language switch: a chip that opens the three languages (the language store). */
export default function LanguageChip() {
  const t = useT();
  const language = useLanguage();
  const setLanguage = useLanguageStore((s) => s.setLanguage);
  const [open, setOpen] = useState(false);
  const chip = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setOpen(false);
      chip.current?.focus();
    };
    const onDown = (e: PointerEvent) => {
      if (!menu.current?.contains(e.target as Node) && !chip.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open]);

  const choose = (lang: (typeof LANGUAGES)[number]) => {
    setLanguage(lang);
    setOpen(false);
    chip.current?.focus();
  };

  return (
    <div className="relative" data-no-swipe>
      <button
        ref={chip}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('onboardingLanguageLabel', { language: LANGUAGE_NAMES[language] })}
        onClick={() => setOpen((o) => !o)}
        className="no-min-size h-11 -my-1.5 px-1 grid place-items-center rounded-full touch-manipulation
          focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-400"
      >
        <span className="h-8 pl-2.5 pr-3 rounded-full inline-flex items-center gap-1.5 text-[14px] font-semibold text-label-secondary bg-white/10 backdrop-blur-xl">
          <Globe className="w-[15px] h-[15px]" strokeWidth={2.2} aria-hidden="true" />
          {language.toUpperCase()}
        </span>
      </button>
      {open && (
        <div
          ref={menu}
          role="menu"
          aria-label={t('languageSelection')}
          className="absolute right-0 top-full mt-2 w-48 rounded-r3 p-1.5 bg-surface-2/95 backdrop-blur-2xl ring-1 ring-white/10 shadow-sheet motion-safe:animate-sheet-in origin-top-right"
        >
          {LANGUAGES.map((lang) => (
            <button
              key={lang}
              type="button"
              role="menuitemradio"
              aria-checked={lang === language}
              onClick={() => choose(lang)}
              onKeyDown={(e) => {
                if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
                e.preventDefault();
                const items = [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ?? [])];
                const i = items.indexOf(e.currentTarget);
                items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]?.focus();
              }}
              className="no-min-size w-full h-11 px-3 rounded-xl flex items-center gap-3 text-left text-[16px] font-medium touch-manipulation
                active:bg-white/8 focus-visible:outline-hidden focus-visible:bg-white/10"
            >
              <span className="w-8 h-6 rounded-md grid place-items-center text-[12px] font-bold bg-white/10 text-label-secondary">{lang.toUpperCase()}</span>
              <span className="flex-1">{LANGUAGE_NAMES[lang]}</span>
              {lang === language && <Check className="w-5 h-5 text-brand-400" strokeWidth={2.5} aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
