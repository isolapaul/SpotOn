import { Z } from '@/lib/constants';
import AppIcon from './AppIcon';
import s from './flow.module.css';

/** The closing line on the live map ("Happy exploring, …!"), announced politely, gone after a moment. */
export default function DoneBanner({ text, leaving }: Readonly<{ text: string; leaving: boolean }>) {
  return (
    <div
      role="status"
      className={`fixed ${Z.onboarding} inset-x-3 mx-auto max-w-[520px] pointer-events-none`}
      style={{ top: 'calc(env(safe-area-inset-top, 0px) + 8px)' }}
    >
      <p className={`${leaving ? s.bannerOut : s.bannerIn} material-sheet shadow-sheet rounded-r3 pl-2.5 pr-4 py-2.5 flex items-center gap-3 text-[15px] font-semibold [overflow-wrap:anywhere]`}>
        <AppIcon size={30} className="shrink-0 rounded-lg" />
        {text}
      </p>
    </div>
  );
}
