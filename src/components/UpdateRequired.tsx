'use client';

import { Download } from 'lucide-react';
import { useT } from '@/hooks/useT';
import { APP_VERSION, Z } from '@/lib/constants';
import { storeUrlFor, updateRequired } from '@/lib/appConfig';
import { nativePlatform } from '@/lib/nativeApp';
import { useAppConfigStore } from '@/store/useAppConfigStore';

/**
 * The apps' update gate: when config/app says this bundled build is too old for the server, the
 * app stops here and links to the store (the web is always current and never shows it).
 */
export default function UpdateRequired() {
  const t = useT();
  const config = useAppConfigStore((s) => s.config);
  const platform = nativePlatform();
  if (!platform || !updateRequired(config, platform, APP_VERSION)) return null;
  const url = storeUrlFor(config, platform);

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="update-title"
      className={`fixed inset-0 ${Z.blocking} bg-surface-0 flex flex-col items-center justify-center gap-5 px-8 text-center`}
    >
      <div className="w-16 h-16 rounded-[18px] bg-brand-600 grid place-items-center shadow-float">
        <Download className="w-8 h-8 text-white" strokeWidth={2.2} aria-hidden="true" />
      </div>
      <h1 id="update-title" className="text-[22px] font-bold text-label">{t('updateRequiredTitle')}</h1>
      <p className="text-[15px] text-label-secondary max-w-[300px]">{t('updateRequiredText')}</p>
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 px-6 h-12 rounded-full bg-brand-600 text-white font-semibold flex items-center justify-center"
        >
          {t('updateRequiredButton')}
        </a>
      )}
    </div>
  );
}
