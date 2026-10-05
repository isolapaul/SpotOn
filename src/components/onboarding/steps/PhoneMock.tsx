import { Bookmark, ChevronLeft, ChevronRight, Layers, Share, SquarePlus } from 'lucide-react';
import AppIcon from '../AppIcon';
import s from './steps.module.css';

/**
 * A phone adding SpotOn to its home screen: Share, then the home-screen item, then the icon lands
 * among the apps. Wordless (the steps below carry the words); plays three times, then rests on the
 * home screen.
 */
export default function PhoneMock() {
  return (
    <div className={s.phone} aria-hidden="true">
      <div className={s.screen}>
        <div className={s.scene1}>
          <div className={s.miniMap} />
          <div className={s.bar}>
            <ChevronLeft className="w-4 h-4" />
            <ChevronRight className="w-4 h-4" />
            <Share className="w-4 h-4" />
            <Bookmark className="w-4 h-4" />
            <Layers className="w-4 h-4" />
          </div>
          <i className={`${s.tap} ${s.tap1}`} style={{ left: '50%', top: 'calc(100% - 21px)' }} />
        </div>
        <div className={s.scene2}>
          <div className={s.miniMap} />
          <div className={s.shareSheet}>
            <div className="flex items-center gap-2 pb-2.5 border-b border-white/10">
              <AppIcon size={26} />
              <span className="flex-1 grid gap-1.5">
                <span className={s.line} style={{ width: '55%' }} />
                <span className={s.line} style={{ width: '80%', opacity: 0.6 }} />
              </span>
            </div>
            <div className={s.row}>
              <Layers className="w-3 h-3 text-white/70" />
              <span className={s.line} style={{ width: '50%' }} />
            </div>
            <div className={s.row}>
              <Bookmark className="w-3 h-3 text-white/70" />
              <span className={s.line} style={{ width: '62%' }} />
            </div>
            <div className={`${s.row} ${s.rowHot}`}>
              <SquarePlus className="w-3 h-3 text-white" />
              <span className={s.line} style={{ width: '70%', background: 'rgb(255 255 255 / .5)' }} />
            </div>
            <i className={`${s.tap} ${s.tap2}`} style={{ left: '50%', top: '138px' }} />
          </div>
        </div>
        <div className={`${s.scene3} ${s.home}`}>
          <div className={s.grid}>
            {Array.from({ length: 9 }, (_, i) => (
              <i key={i} />
            ))}
            <span className={`${s.appIn} block`}>
              <AppIcon size={36} className="w-full h-full" />
            </span>
            <i />
            <i />
          </div>
        </div>
      </div>
    </div>
  );
}
