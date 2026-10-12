import { useCallback, useEffect, useState } from 'react';
import { loadTelemetry, type ClientErrorRow } from '@/store/telemetryAdmin';
import type { DayStats } from '@/lib/telemetry';

type State = { status: 'loading' } | { status: 'error' } | { status: 'ready'; days: DayStats[]; errors: ClientErrorRow[] };

/** The super admin's telemetry overview, loaded once (reload on demand). */
export function useTelemetryOverview() {
  const [state, setState] = useState<State>({ status: 'loading' });
  const load = useCallback(() => {
    loadTelemetry().then(
      (data) => setState({ status: 'ready', ...data }),
      (error: unknown) => {
        console.error('Telemetry load failed:', error);
        setState({ status: 'error' });
      },
    );
  }, []);
  useEffect(load, [load]);
  return { state, reload: () => { setState({ status: 'loading' }); load(); } };
}
