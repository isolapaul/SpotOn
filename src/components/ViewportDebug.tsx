'use client';

// TEMPORARY diagnostics for the iOS home-screen bottom band (design 1A). Renders only on Vercel
// branch previews (host contains "-git-") inside the installed app; never in production. Remove
// once the band is fixed.
import { useEffect, useState } from 'react';

const FIXES = [
  { cls: 'vpd-doc-tall', label: 'A: html+body = app height' },
  { cls: 'vpd-overflow-visible', label: 'B: html overflow visible' },
  { cls: 'vpd-root-absolute', label: 'C: app root absolute' },
  { cls: 'vpd-paint', label: 'D: paint page pink, map blue' },
] as const;

function probe(css: string): number {
  const el = document.createElement('div');
  el.style.cssText = `position:absolute;visibility:hidden;left:0;top:0;width:1px;${css}`;
  document.body.appendChild(el);
  const h = el.getBoundingClientRect().height;
  el.remove();
  return Math.round(h);
}

export default function ViewportDebug() {
  const [enabled] = useState(() => {
    if (typeof window === 'undefined') return false;
    const nav = navigator as Navigator & { standalone?: boolean };
    return window.location.hostname.includes('-git-') && nav.standalone === true;
  });
  const [open, setOpen] = useState(true);
  const [active, setActive] = useState<string[]>([]);
  const [info, setInfo] = useState('');

  useEffect(() => {
    if (!enabled) return;
    const root = document.documentElement;
    for (const f of FIXES) root.classList.toggle(f.cls, active.includes(f.cls));
    const measure = () => {
      const cs = getComputedStyle(root);
      setInfo(
        [
          `inner ${window.innerWidth}x${window.innerHeight}`,
          `screen ${screen.width}x${screen.height}`,
          `visualVP ${Math.round(window.visualViewport?.height ?? 0)}`,
          `docEl.clientH ${root.clientHeight}`,
          `--app-h ${cs.getPropertyValue('--app-h')}`,
          `vh ${probe('height:100vh')} dvh ${probe('height:100dvh')} lvh ${probe('height:100lvh')} svh ${probe('height:100svh')}`,
          `safe top ${probe('height:env(safe-area-inset-top)')} bottom ${probe('height:env(safe-area-inset-bottom)')}`,
          `main ${Math.round(document.querySelector('main')?.getBoundingClientRect().height ?? 0)}`,
        ].join('\n'),
      );
    };
    measure();
    const id = setTimeout(measure, 800);
    return () => clearTimeout(id);
  }, [enabled, active]);

  if (!enabled) return null;
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="fixed z-[99999] left-2 bg-fuchsia-600 text-white text-xs font-bold px-3 py-2 rounded-full" style={{ top: 'calc(env(safe-area-inset-top) + 64px)' }}>
        VP
      </button>
    );
  }
  return (
    <div className="fixed z-[99999] left-2 right-2 bg-black/85 text-white text-[11px] p-3 rounded-2xl font-mono" style={{ top: 'calc(env(safe-area-inset-top) + 64px)' }}>
      <pre className="whitespace-pre-wrap mb-2">{info}</pre>
      <div className="flex flex-col gap-1.5">
        {FIXES.map((f) => (
          <button
            key={f.cls}
            onClick={() => setActive((a) => (a.includes(f.cls) ? a.filter((c) => c !== f.cls) : [...a, f.cls]))}
            className={`text-left px-3 py-2 rounded-lg ${active.includes(f.cls) ? 'bg-fuchsia-600' : 'bg-white/15'}`}
          >
            {active.includes(f.cls) ? '✓ ' : ''}{f.label}
          </button>
        ))}
        <button onClick={() => setOpen(false)} className="px-3 py-2 rounded-lg bg-white/10">Hide</button>
      </div>
    </div>
  );
}
