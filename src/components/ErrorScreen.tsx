'use client';

import { CloudOff, Compass } from 'lucide-react';
import { useT } from '@/hooks/useT';

/**
 * A friendly full-screen fallback (the app's error boundary and unknown addresses): what happened
 * and one way on (try again, or back to the map). Never a blank page or the framework's default.
 */
export default function ErrorScreen({ kind, onRetry }: Readonly<{ kind: 'error' | 'notFound'; onRetry?: () => void }>) {
  const t = useT();
  const Icon = kind === 'error' ? CloudOff : Compass;
  return (
    <main className="fixed inset-0 grid place-items-center bg-surface-0 px-8 text-center">
      <div className="flex flex-col items-center motion-safe:animate-rise-in">
        <span className="w-20 h-20 rounded-3xl grid place-items-center bg-brand-500/15 text-brand-400">
          <Icon className="w-10 h-10" strokeWidth={1.8} aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-label text-[22px] font-bold">{t(kind === 'error' ? 'errorScreenTitle' : 'notFoundTitle')}</h1>
        <p className="mt-2 max-w-xs text-label-secondary text-[15px] leading-snug">
          {t(kind === 'error' ? 'errorScreenText' : 'notFoundText')}
        </p>
        <div className="mt-6 flex gap-3">
          {onRetry && (
            <button type="button" onClick={onRetry} className="h-11 px-5 rounded-full bg-brand-600 text-white font-semibold">
              {t('tryAgain')}
            </button>
          )}
          {/* A full load (not a client navigation): whatever broke starts fresh. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/" className={`h-11 px-5 rounded-full font-semibold inline-flex items-center ${onRetry ? 'bg-white/10 text-label' : 'bg-brand-600 text-white'}`}>
            {t('backToMap')}
          </a>
        </div>
      </div>
    </main>
  );
}
