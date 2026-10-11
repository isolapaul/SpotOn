'use client';

import { Activity, Bug, RotateCw } from 'lucide-react';
import { useT } from '@/hooks/useT';
import { useTelemetryOverview } from '@/hooks/useTelemetryOverview';
import type { TranslationKey } from '@/lib/translations';
import type { DayStats, TelemetryEvent } from '@/lib/telemetry';

/** The funnel's steps, in order, with their labels. */
const FUNNEL: Array<[TelemetryEvent, TranslationKey]> = [
  ['app_open', 'statAppOpen'],
  ['sign_up', 'statSignUp'],
  ['first_spot', 'statFirstSpot'],
  ['spot_submitted', 'statSpotSubmitted'],
  ['review_written', 'statReview'],
  ['visit', 'statVisit'],
  ['invite_claimed', 'statInviteClaimed'],
  ['spot_shared', 'statShared'],
];

function sum(days: DayStats[], event: TelemetryEvent): number {
  return days.reduce((n, d) => n + (d.totals[event] ?? 0), 0);
}

/** Super admin: anonymous counters for 7 and 30 days, opens per platform, the latest app errors. */
export default function TelemetryOverview() {
  const t = useT();
  const { state, reload } = useTelemetryOverview();

  return (
    <div className="glass-card p-6 flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <Activity className="w-5 h-5 text-brand-400" aria-hidden="true" />
        <h3 className="text-white font-bold text-lg">{t('statsTitle')}</h3>
        <button type="button" onClick={reload} aria-label={t('statsReload')} className="no-min-size ml-auto w-9 h-9 grid place-items-center rounded-full bg-white/8">
          <RotateCw className="w-4 h-4 text-label-secondary" aria-hidden="true" />
        </button>
      </div>
      {state.status === 'loading' && <p className="text-label-secondary text-sm">{t('loading')}</p>}
      {state.status === 'error' && <p className="text-red-300 text-sm">{t('genericError')}</p>}
      {state.status === 'ready' && (
        <>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-label-tertiary text-xs">
                <th className="text-left font-medium pb-2">{t('statsEvent')}</th>
                <th className="text-right font-medium pb-2">{t('stats7Days')}</th>
                <th className="text-right font-medium pb-2">{t('stats30Days')}</th>
              </tr>
            </thead>
            <tbody>
              {FUNNEL.map(([event, label]) => (
                <tr key={event} className="border-t border-white/6">
                  <td className="py-1.5 text-label">{t(label)}</td>
                  <td className="py-1.5 text-right tabular-nums text-label">{sum(state.days.slice(0, 7), event)}</td>
                  <td className="py-1.5 text-right tabular-nums text-label-secondary">{sum(state.days, event)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-label-tertiary">
            {t('statsOpensByPlatform', {
              web: state.days.slice(0, 7).reduce((n, d) => n + d.byPlatform.web, 0),
              ios: state.days.slice(0, 7).reduce((n, d) => n + d.byPlatform.ios, 0),
              android: state.days.slice(0, 7).reduce((n, d) => n + d.byPlatform.android, 0),
            })}
          </p>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-label font-semibold text-sm">
              <Bug className="w-4 h-4 text-red-300" aria-hidden="true" />
              {t('statsErrors')}
            </div>
            {state.errors.length === 0 ? (
              <p className="text-label-secondary text-sm">{t('statsNoErrors')}</p>
            ) : (
              state.errors.map((e) => (
                <div key={e.id} className="rounded-xl bg-white/5 p-3">
                  <p className="text-label text-[13px] break-words">{e.message}</p>
                  <p className="text-label-tertiary text-[11px] mt-1">
                    {e.count}× · {e.platform} {e.version} · {e.path} · {e.lastSeen ? new Date(e.lastSeen).toLocaleString() : ''}
                  </p>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
