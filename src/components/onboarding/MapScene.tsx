import { useEffect, useRef, useState } from 'react';
import { CAMERAS, DISCOVER_EXPLORE_AT_MS, worldTransform, type SceneShot } from '@/lib/onboardingScene';
import type { LocationChoice, OnboardingStep } from '@/lib/onboarding';
import SceneMap from './SceneMap';
import SceneMarkers from './SceneMarkers';
import SceneOverlays from './SceneOverlays';
import s from './scene.module.css';

// The stage behind the tour: the demo city with the app's pins and chrome. A camera flies between
// the steps (one transform on the world); everything here is decorative (aria-hidden).

function useStageSize(ref: React.RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState(() => ({ w: globalThis.innerWidth || 390, h: globalThis.innerHeight || 844 }));
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setSize({ w: entry.contentRect.width, h: entry.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

/** On the discover step the place card shows first, then the Explore sheet (at once with reduced motion). */
function useExploring(step: OnboardingStep, reducedMotion: boolean): boolean {
  const [exploringStep, setExploringStep] = useState<OnboardingStep | null>(null);
  useEffect(() => {
    if (step !== 'discover' || reducedMotion) return;
    const timer = setTimeout(() => setExploringStep(step), DISCOVER_EXPLORE_AT_MS);
    return () => clearTimeout(timer);
  }, [step, reducedMotion]);
  return step === 'discover' && (reducedMotion || exploringStep === step);
}

interface MapSceneProps {
  step: OnboardingStep;
  closing: boolean;
  reducedMotion: boolean;
  locationChoice: LocationChoice | null;
}

export default function MapScene({ step, closing, reducedMotion, locationChoice }: Readonly<MapSceneProps>) {
  const ref = useRef<HTMLDivElement>(null);
  const { w, h } = useStageSize(ref);
  const exploring = useExploring(step, reducedMotion);
  let shot: SceneShot = step;
  if (closing) shot = 'done';
  else if (exploring) shot = 'explore';
  const camera = CAMERAS[shot];

  return (
    <div ref={ref} className={s.scene} aria-hidden="true">
      <div className={s.parallax}>
        <div className={s.world} style={{ transform: worldTransform(camera, w, h) }}>
          <SceneMap />
          <SceneMarkers step={step} zoom={camera.s} locationChoice={locationChoice} selectedId={step === 'discover' ? 's1' : null} />
        </div>
      </div>
      {!closing && <SceneOverlays step={step} exploring={exploring} />}
    </div>
  );
}
