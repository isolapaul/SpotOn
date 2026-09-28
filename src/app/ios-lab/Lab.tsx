'use client';

// TEMPORARY (see page.tsx). Every candidate fix for the iOS 26 bottom band, toggled live on the device.
// Magenta = the page background: where it shows, nothing we draw reaches. The lime bar marks the
// bottom edge of the full-screen layer.
import { useCallback, useEffect, useState } from 'react';

type Layer = 'inset' | 'lvh' | 'screen' | 'vh';
interface Settings { layer: Layer; htmlScreen: boolean; deviceHeightMeta: boolean }
const KEY = 'ios-lab-settings';
const DEFAULTS: Settings = { layer: 'inset', htmlScreen: false, deviceHeightMeta: false };
const BASE_VIEWPORT = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';

function load(): Settings {
  try {
    return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Settings>) };
  } catch {
    return DEFAULTS;
  }
}

function probe(css: string): number {
  const el = document.createElement('div');
  el.style.cssText = `position:fixed;visibility:hidden;left:0;top:0;width:1px;${css}`;
  document.body.appendChild(el);
  const h = el.getBoundingClientRect().height;
  el.remove();
  return Math.round(h);
}

function viewportMeta(): HTMLMetaElement | null {
  return document.querySelector('meta[name="viewport"]');
}

function screenLong(): number {
  return Math.max(screen.width, screen.height);
}

export default function Lab() {
  const [s, setS] = useState<Settings>(DEFAULTS);
  const [ready, setReady] = useState(false);
  const [info, setInfo] = useState('');
  const [log, setLog] = useState<string[]>([]);

  const note = (line: string) => setLog((l) => [`${new Date().toLocaleTimeString()} ${line}`, ...l].slice(0, 6));

  const measure = useCallback(() => {
    const root = document.documentElement;
    const nav = navigator as Navigator & { standalone?: boolean };
    setInfo(
      [
        `standalone ${String(nav.standalone)}  screen ${screen.width}x${screen.height}`,
        `inner ${window.innerWidth}x${window.innerHeight}  visualVP ${Math.round(window.visualViewport?.height ?? 0)}`,
        `html.clientH ${root.clientHeight}  body ${Math.round(document.body.getBoundingClientRect().height)}`,
        `vh ${probe('height:100vh')} dvh ${probe('height:100dvh')} lvh ${probe('height:100lvh')} svh ${probe('height:100svh')}`,
        `inset0 ${probe('bottom:0')}  safe top ${probe('height:env(safe-area-inset-top)')} bottom ${probe('height:env(safe-area-inset-bottom)')}`,
        `viewport: ${viewportMeta()?.content.replace('width=device-width, ', '') ?? '-'}`,
      ].join('\n'),
    );
  }, []);

  useEffect(() => {
    const loaded = load();
    // Deliberately synchronous: the lab applies saved settings on the very first paint.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setS(loaded);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch {
      /* private mode: settings just do not survive a reload */
    }
    const root = document.documentElement;
    root.style.backgroundColor = '#ff00ff';
    document.body.style.backgroundColor = 'transparent';
    const h = s.htmlScreen ? `${screenLong()}px` : '';
    root.style.height = h;
    document.body.style.height = h;
    root.style.overflow = s.htmlScreen ? 'visible' : '';
    const meta = viewportMeta();
    if (meta) meta.content = s.deviceHeightMeta ? `${BASE_VIEWPORT}, height=device-height` : BASE_VIEWPORT;
    const id = setTimeout(measure, 300);
    window.addEventListener('resize', measure);
    return () => {
      clearTimeout(id);
      window.removeEventListener('resize', measure);
    };
  }, [s, ready, measure]);

  const toggleFit = () => {
    const meta = viewportMeta();
    if (!meta) return;
    const full = meta.content;
    meta.content = full.replace(', viewport-fit=cover', '');
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        meta.content = full;
        note('viewport-fit removed and re-added');
        setTimeout(measure, 300);
      }),
    );
  };

  const keyboard = () => {
    const input = document.getElementById('lab-input') as HTMLInputElement | null;
    input?.focus();
    note('keyboard opened, close it, then look');
  };

  const nudge = () => {
    window.scrollTo(0, 1);
    setTimeout(() => {
      window.scrollTo(0, 0);
      note('scroll nudge done');
      measure();
    }, 100);
  };

  const layerStyle: React.CSSProperties =
    s.layer === 'inset'
      ? { top: 0, bottom: 0 }
      : { top: 0, height: s.layer === 'screen' ? `${screenLong()}px` : s.layer === 'lvh' ? '100lvh' : '100vh' };

  const btn = (on: boolean) =>
    `px-3 py-2.5 rounded-xl text-[13px] font-semibold ${on ? 'bg-lime-400 text-black' : 'bg-white/15 text-white'}`;

  return (
    <div
      className="fixed left-0 right-0 overflow-hidden text-white"
      style={{
        ...layerStyle,
        background: 'repeating-linear-gradient(to bottom, #1d4ed8 0 49px, #93c5fd 49px 50px)',
      }}
    >
      <div className="absolute left-0 right-0 bottom-0 h-3 bg-lime-400" />
      <div className="absolute left-3 right-3 font-mono text-[11px] bg-black/80 rounded-2xl p-3" style={{ top: 'calc(env(safe-area-inset-top) + 8px)' }}>
        <pre className="whitespace-pre-wrap">{info}</pre>
        {log.length > 0 && <pre className="whitespace-pre-wrap text-lime-300 mt-1">{log.join('\n')}</pre>}
      </div>
      <div className="absolute left-3 right-3 flex flex-col gap-2 bg-black/80 rounded-2xl p-3" style={{ top: 'calc(env(safe-area-inset-top) + 190px)' }}>
        <div className="grid grid-cols-4 gap-1.5">
          {(['inset', 'lvh', 'screen', 'vh'] as const).map((l) => (
            <button key={l} className={btn(s.layer === l)} onClick={() => setS({ ...s, layer: l })}>
              {l === 'inset' ? 'A inset0' : l === 'lvh' ? 'B lvh' : l === 'screen' ? 'C screen' : 'D vh'}
            </button>
          ))}
        </div>
        <button className={btn(s.htmlScreen)} onClick={() => setS({ ...s, htmlScreen: !s.htmlScreen })}>
          E: html + body = screen height
        </button>
        <button className={btn(s.deviceHeightMeta)} onClick={() => setS({ ...s, deviceHeightMeta: !s.deviceHeightMeta })}>
          F: viewport height=device-height
        </button>
        <div className="grid grid-cols-3 gap-1.5">
          <button className={btn(false)} onClick={toggleFit}>G fit toggle</button>
          <button className={btn(false)} onClick={keyboard}>H keyboard</button>
          <button className={btn(false)} onClick={nudge}>I scroll</button>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <button className={btn(false)} onClick={() => window.location.reload()}>Reload</button>
          <button className={btn(false)} onClick={() => setS(DEFAULTS)}>Reset</button>
        </div>
        <input id="lab-input" aria-label="keyboard test" className="h-9 rounded-lg bg-white/10 px-2 text-[16px]" placeholder="keyboard test" onBlur={() => setTimeout(measure, 500)} />
      </div>
    </div>
  );
}
