// The page the service worker shows when a navigation fails offline (instead of the browser's
// error page, e.g. inside the Android app). Static, no scripts; the language follows the device.
// Pure: the service worker bundles it (src/sw).

const TEXT = {
  hu: { title: 'Nincs internetkapcsolat', body: 'A SpotOnhoz internet kell. Ellenőrizd a kapcsolatot, és próbáld újra.', retry: 'Újrapróbálás' },
  en: { title: 'You are offline', body: 'SpotOn needs the internet. Check your connection and try again.', retry: 'Try again' },
  de: { title: 'Keine Internetverbindung', body: 'SpotOn braucht Internet. Prüfe deine Verbindung und versuche es erneut.', retry: 'Erneut versuchen' },
} as const;

/** The offline page's language from the browser's language tag (Hungarian when unknown, as the app). */
export function offlineLanguage(tag: string | undefined): keyof typeof TEXT {
  const base = (tag ?? '').toLowerCase().slice(0, 2);
  return base === 'en' || base === 'de' ? base : 'hu';
}

/** The full HTML document. The retry is a plain link to the start page (no script needed). */
export function offlineHtml(tag: string | undefined): string {
  const lang = offlineLanguage(tag);
  const t = TEXT[lang];
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#12814f"><title>SpotOn</title>
<style>html,body{height:100%;margin:0}body{display:flex;align-items:center;justify-content:center;background:#1b1c1e;color:#f5f5f7;
font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;text-align:center;padding:24px;box-sizing:border-box}
img{width:88px;height:88px;border-radius:22px}h1{font-size:22px;margin:20px 0 8px}p{color:#a1a1aa;margin:0 0 24px;max-width:320px;line-height:1.45}
a{display:inline-block;background:#12814f;color:#fff;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:999px}</style>
</head><body><main><img src="/icon-192x192.png" alt=""><h1>${t.title}</h1><p>${t.body}</p><a href="/">${t.retry}</a></main></body></html>`;
}

/** The policy sent with it: nothing but its own inline style and the cached icon. */
export const OFFLINE_CSP = "default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; base-uri 'none'; form-action 'none'";
