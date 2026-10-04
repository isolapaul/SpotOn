import type { ReactNode } from 'react';
import s from './flow.module.css';

/**
 * The bottom sheet of the full-screen steps (name, location, install, sign-up). It scrolls on its
 * own when a short or landscape screen cannot fit it.
 */
export default function StepSheet({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <section className={`${s.sheetIn} material-sheet shadow-sheet rounded-r4 px-5 max-[359px]:px-3.5 pt-2.5 pb-4 shrink-0 max-h-full overflow-y-auto overscroll-contain scrollbar-hide`}>
      <span aria-hidden="true" className="block mx-auto mb-1 w-9 h-[5px] rounded-full bg-white/25" />
      {children}
    </section>
  );
}

/** The stagger of a sheet's parts. */
export function riseDelay(ms: number) {
  return { animationDelay: `${ms}ms` };
}
