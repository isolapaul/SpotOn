import type { CSSProperties, ReactNode } from 'react';
import { Heart, LocateFixed, CheckCircle2, Clock } from 'lucide-react';
import { useLanguage, useT } from '@/hooks/useT';
import { formatDistance } from '@/lib/geo';
import { DISTANCES, NEW_SPOT, SCENE_SPOTS, USER_SPOT, markerTransform } from '@/lib/onboardingScene';
import type { LocationChoice, OnboardingStep } from '@/lib/onboarding';
import StarRating from '@/components/ui/StarRating';
import ScenePin from './ScenePin';
import s from './scene.module.css';

// What stands on the demo map, in world coordinates; each marker is counter-scaled by the camera
// zoom so it keeps its size on screen (pins, the visitor's new spot, the location puck, bubbles).

function Marker({ x, y, zoom, className = '', children }: Readonly<{ x: number; y: number; zoom: number; className?: string; children: ReactNode }>) {
  return (
    <div className={`${s.marker} ${className}`} style={{ transform: markerTransform(x, y, zoom) }}>
      {children}
    </div>
  );
}

const STEPS_WITH_NEW_SPOT: readonly OnboardingStep[] = ['add', 'levels', 'location'];

/** The visitor's shared spot: on the share step it drops in under review and flips to approved. */
function NewSpot({ animated }: Readonly<{ animated: boolean }>) {
  const t = useT();
  return (
    <div className={s.newPin}>
      {animated && (
        <div className={s.pendingPin}>
          <ScenePin category="scenic" variant="pending" />
        </div>
      )}
      <div className={animated ? s.approvedPin : s.pinAt}>
        <ScenePin category="scenic" />
      </div>
      {animated && (
        <>
          <i className={s.pinPing} />
          <span className={`${s.chipPending} h-7 pl-2 pr-2.5 rounded-full inline-flex items-center gap-1.5 text-[13px] font-semibold bg-warn-ink text-warn-500 shadow-float`}>
            <Clock className="w-3.5 h-3.5" strokeWidth={2.4} />
            {t('pending')}
          </span>
          <span className={`${s.chipApproved} h-7 pl-2 pr-2.5 rounded-full inline-flex items-center gap-1.5 text-[13px] font-semibold bg-[#0d3d27] text-brand-300 shadow-float`}>
            <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2.4} />
            {t('approved')}
          </span>
          <span className={`${s.xpFloat} text-[15px] font-extrabold text-brand-300`}>{t('onboardingXpGain', { xp: 10 })}</span>
        </>
      )}
    </div>
  );
}

function ReviewBubble() {
  const t = useT();
  return (
    <div className={`${s.bubble} [@media(max-height:779px)]:hidden`}>
      <div className={`${s.sheet} ${s.bubbleIn} w-max max-w-[200px] rounded-2xl px-3 py-2.5 text-[13px] leading-snug`} style={{ animationDelay: '1.1s' }}>
        <span className="flex items-center gap-1.5 font-semibold mb-1">
          <span className="w-5 h-5 rounded-full grid place-items-center text-[11px] font-bold text-white bg-[#AF52DE]">L</span>
          lili
          <StarRating rating={5} size="xs" emptyTone="dim" />
        </span>
        {t('onboardingDemoReview')}
      </div>
      {[{ hx: '-14px', hr: '-12deg', d: '1.6s', size: 'w-[18px] h-[18px]' }, { hx: '10px', hr: '10deg', d: '2.1s', size: 'w-3.5 h-3.5' }].map((h) => (
        <i key={h.d} className={s.heart} style={{ '--hx': h.hx, '--hr': h.hr, animationDelay: h.d, left: '50%' } as CSSProperties}>
          <Heart className={`${h.size} fill-current`} strokeWidth={0} />
        </i>
      ))}
    </div>
  );
}

interface SceneMarkersProps {
  step: OnboardingStep;
  zoom: number;
  locationChoice: LocationChoice | null;
  /** The discover step's tapped pin is selected. */
  selectedId: string | null;
}

export default function SceneMarkers({ step, zoom, locationChoice, selectedId }: Readonly<SceneMarkersProps>) {
  const language = useLanguage();
  const located = locationChoice === 'allowed';
  return (
    <>
      {step === 'location' && !located && (
        <Marker x={USER_SPOT.x} y={USER_SPOT.y} zoom={zoom}>
          <i className={s.pulse} />
          <i className={s.pulse} />
          <i className={s.pulse} />
          <span className={`${s.centered} w-[52px] h-[52px] rounded-full grid place-items-center bg-locate/20 text-[#6fb6ff] ring-[1.5px] ring-locate/55 ring-inset`}>
            <LocateFixed className="w-6 h-6" strokeWidth={2.2} />
          </span>
        </Marker>
      )}
      {SCENE_SPOTS.map((spot, i) => (
        <Marker key={spot.id} x={spot.x} y={spot.y} zoom={zoom}>
          {step === 'discover' && spot.id === selectedId && (
            <>
              <i className={s.ripple} />
              <i className={s.ripple} />
            </>
          )}
          <div className={s.pinAt}>
            <ScenePin category={spot.category} selected={spot.id === selectedId} delayMs={300 + i * 70} />
          </div>
          {step === 'levels' && spot.id === 's2' && <ReviewBubble />}
        </Marker>
      ))}
      {STEPS_WITH_NEW_SPOT.includes(step) && (
        <Marker key={step === 'add' ? 'new-animated' : 'new'} x={NEW_SPOT.x} y={NEW_SPOT.y} zoom={zoom}>
          <NewSpot animated={step === 'add'} />
        </Marker>
      )}
      {located && (
        <Marker x={USER_SPOT.x} y={USER_SPOT.y} zoom={zoom}>
          <span className={s.centered}>
            <span className={`user-puck block ${s.popIn}`}>
              <span className="user-puck__halo" />
              <span className="user-puck__dot" />
            </span>
          </span>
        </Marker>
      )}
      {located &&
        DISTANCES.map((d) => {
          const spot = SCENE_SPOTS.find((x) => x.id === d.id);
          if (!spot) return null;
          return (
            <Marker key={d.id} x={spot.x} y={spot.y} zoom={zoom}>
              <span className="absolute left-0 top-1.5 -translate-x-1/2">
                <span className={`${s.chrome} ${s.popIn} h-[22px] px-2 rounded-full grid place-items-center text-[12px] font-bold whitespace-nowrap tabular-nums`}>
                  {formatDistance(d.metres / 1000, language)}
                </span>
              </span>
            </Marker>
          );
        })}
    </>
  );
}
