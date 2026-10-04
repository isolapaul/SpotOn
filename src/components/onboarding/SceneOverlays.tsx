import { Bell, Camera, Compass, Heart, Layers, LocateFixed, MessageSquareText, Navigation, Plus, Search, Share, UserRound, X } from 'lucide-react';
import { useLanguage, useT } from '@/hooks/useT';
import { formatDistance } from '@/lib/geo';
import { CATEGORY_LABEL_KEY } from '@/lib/categories';
import type { OnboardingStep } from '@/lib/onboarding';
import CategoryIcon from '@/components/ui/CategoryIcon';
import StarRating from '@/components/ui/StarRating';
import ScenePhoto, { type ScenePhotoKind } from './ScenePhoto';
import s from './scene.module.css';

// The app's own chrome over the demo map, as pictures (decorative, aria-hidden by MapScene): the
// control stack, the launcher with +, the place card, the Explore sheet and the new-spot sheet.

const BOTTOM = { bottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)' } as const;
const ABOVE_DOCK = { bottom: 'calc(env(safe-area-inset-bottom, 0px) + 72px)' } as const;

function Grabber() {
  return <span className="block mx-auto w-9 h-[5px] rounded-full bg-white/25" />;
}

function Controls({ on }: Readonly<{ on: boolean }>) {
  return (
    <div data-on={on} className={`${s.controls} ${s.chrome} absolute right-3 top-[38%] w-11 rounded-full flex flex-col items-center py-0.5`}>
      {[Bell, Layers, MessageSquareText, LocateFixed].map((Icon, i) => (
        <span key={i} className={`w-11 h-11 grid place-items-center ${i > 0 ? 'border-t border-white/10' : ''} ${i === 3 ? 'text-locate' : 'text-white/80'}`}>
          <Icon className="w-5 h-5" strokeWidth={2} />
        </span>
      ))}
    </div>
  );
}

function Dock({ on, pressing }: Readonly<{ on: boolean; pressing: boolean }>) {
  const t = useT();
  return (
    <div data-on={on} className={`${s.dock} absolute inset-x-3 flex items-center gap-2 max-w-[520px] mx-auto`} style={BOTTOM}>
      <div className={`${s.chrome} h-14 flex-1 min-w-0 rounded-full flex items-center gap-3 pl-[18px] pr-2`}>
        <Compass className="w-6 h-6 shrink-0 text-brand-400" strokeWidth={2} />
        <span className="min-w-0 flex-1">
          <span className="block text-[17px] font-semibold leading-tight truncate">{t('explore')}</span>
          <span className="block text-[13px] leading-tight text-[rgb(190_194_202)] tabular-nums truncate">{t('spotCountMany', { count: 128 })}</span>
        </span>
        <span className="w-10 h-10 rounded-full grid place-items-center bg-white/10 text-[rgb(190_194_202)]">
          <UserRound className="w-[22px] h-[22px]" strokeWidth={2} />
        </span>
      </div>
      <span className={`relative w-14 h-14 shrink-0 rounded-full grid place-items-center bg-brand-600 text-white shadow-[0_6px_18px_rgb(18_129_79/0.45)] ${pressing ? s.addButton : ''}`}>
        <Plus className="w-7 h-7" strokeWidth={2.4} />
        {pressing && <i className={s.addPing} />}
      </span>
    </div>
  );
}

function PlaceCard() {
  const t = useT();
  const language = useLanguage();
  return (
    <div className={`${s.placeCard} absolute inset-x-2 max-w-[520px] mx-auto`} style={BOTTOM}>
      <div className={`${s.sheet} rounded-r4 px-4 pt-3 pb-4`}>
        <Grabber />
        <div className="mt-2.5 flex gap-3.5">
          <ScenePhoto kind="sunset" className="w-[88px] h-[88px] shrink-0 rounded-[18px]" />
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="text-[17px] font-semibold leading-snug truncate">{t('onboardingDemoSpotCitadel')}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-[15px] text-label-secondary min-w-0">
              <CategoryIcon category="viewpoint" className="w-4 h-4 shrink-0 text-brand-400" />
              <span className="truncate">
                {t('categoryViewpoint')} · <span className="tabular-nums">{formatDistance(1.2, language)}</span>
              </span>
            </p>
            <p className="mt-1 flex items-center gap-1 text-[15px]">
              <StarRating rating={5} size="sm" emptyTone="dim" wrapper={false} />
              <span className="ml-1 tabular-nums">{language === 'en' ? '4.8' : '4,8'}</span>
              <span className="text-label-tertiary tabular-nums">(23)</span>
            </p>
          </div>
          <span className="w-[30px] h-[30px] shrink-0 rounded-full grid place-items-center bg-white/10">
            <Share className="w-4 h-4" strokeWidth={2.4} />
          </span>
        </div>
        <div className="mt-3.5 flex gap-2">
          <span className="flex-1 h-11 rounded-full bg-brand-600 inline-flex items-center justify-center gap-2 text-[15px] font-semibold">
            <Navigation className="w-[17px] h-[17px]" strokeWidth={2.4} />
            {t('directions')}
          </span>
          <span className="w-11 h-11 rounded-full bg-white/10 grid place-items-center">
            <Heart className="w-[19px] h-[19px]" strokeWidth={2.2} />
          </span>
          <span className="flex-1 h-11 rounded-full bg-white/10 inline-flex items-center justify-center text-[15px] font-semibold">{t('details')}</span>
        </div>
      </div>
    </div>
  );
}

const ROWS: readonly { photo: ScenePhotoKind; name: 'onboardingDemoSpotCourtyard' | 'onboardingDemoSpotShore'; category: 'smoke-spot' | 'part'; rating: string }[] = [
  { photo: 'alley', name: 'onboardingDemoSpotCourtyard', category: 'smoke-spot', rating: '4,9' },
  { photo: 'beach', name: 'onboardingDemoSpotShore', category: 'part', rating: '4,6' },
];

function ExploreSheet() {
  const t = useT();
  const language = useLanguage();
  const rating = (r: string) => (language === 'en' ? r.replace(',', '.') : r);
  const delay = (ms: number) => ({ animationDelay: `${ms}ms` });
  return (
    <div className={`${s.exploreSheet} ${s.sheet} absolute inset-x-0 bottom-0 h-[56%] min-h-[300px] max-h-[480px] rounded-t-r4 px-4 pt-2.5 overflow-hidden max-w-[560px] mx-auto`}>
      <Grabber />
      <div className={`${s.itemIn} flex items-center justify-between mt-2.5 mb-3`} style={delay(250)}>
        <span className="text-[24px] font-bold tracking-tight">{t('explore')}</span>
        <span className="w-[30px] h-[30px] rounded-full grid place-items-center bg-white/10">
          <X className="w-4 h-4" strokeWidth={2.5} />
        </span>
      </div>
      <div className={`${s.itemIn} h-10 rounded-xl bg-white/8 flex items-center gap-2 px-3 text-label-tertiary text-[16px]`} style={delay(320)}>
        <Search className="w-[18px] h-[18px]" strokeWidth={2} />
        <span className="truncate">{t('searchSpotsPlaceholder')}</span>
      </div>
      <p className={`${s.itemIn} mt-4 mb-2.5 text-[13px] font-semibold uppercase tracking-[0.04em] text-label-tertiary`} style={delay(400)}>
        {t('newThisWeek')}
      </p>
      <div className={`${s.itemIn} relative h-[150px] rounded-r3 overflow-hidden`} style={delay(460)}>
        <ScenePhoto kind="lake" className="absolute inset-0 w-full h-full" />
        <span className="absolute inset-0 bg-linear-to-t from-black/70 to-transparent to-60%" />
        <span className="absolute left-3 top-3 h-6 px-2.5 rounded-full bg-brand-500 grid place-items-center text-[12px] font-bold">{t('onboardingSceneNewBadge')}</span>
        <span className="absolute inset-x-3.5 bottom-3">
          <span className="block text-[18px] font-semibold truncate">{t('onboardingDemoSpotLake')}</span>
          <span className="flex items-center gap-1.5 text-[14px] text-white/75">
            <CategoryIcon category="park" className="w-[15px] h-[15px]" />
            {t('categoryPark')} · <span className="tabular-nums">{formatDistance(2.4, language)}</span>
          </span>
        </span>
      </div>
      {ROWS.map((row, i) => (
        <div key={row.name} className={`${s.itemIn} flex items-center gap-3 py-2.5 border-b border-separator`} style={delay(540 + i * 80)}>
          <ScenePhoto kind={row.photo} className="w-14 h-14 shrink-0 rounded-[14px]" />
          <span className="min-w-0">
            <span className="block text-[16px] font-semibold truncate">{t(row.name)}</span>
            <span className="flex items-center gap-1.5 text-[14px] text-label-secondary whitespace-nowrap">
              <CategoryIcon category={row.category} className="w-3.5 h-3.5 text-brand-400" />
              {t(CATEGORY_LABEL_KEY[row.category])} · <StarRating rating={5} size="xs" emptyTone="dim" /> {rating(row.rating)}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}

function AddSheet() {
  const t = useT();
  const photos: readonly ScenePhotoKind[] = ['sunset', 'city', 'beach'];
  return (
    <div className={`${s.addSheet} ${s.sheet} absolute inset-x-2 max-w-[520px] mx-auto rounded-r4 px-4 pt-2.5 pb-4`} style={ABOVE_DOCK}>
      <Grabber />
      <div className="flex items-center justify-between mt-2 mb-3">
        <span className="text-[17px] font-semibold">{t('onboardingAddSheetTitle')}</span>
        <span className="w-[30px] h-[30px] rounded-full grid place-items-center bg-white/10">
          <X className="w-4 h-4" strokeWidth={2.5} />
        </span>
      </div>
      <div className="h-11 rounded-xl bg-surface-3 flex items-center px-3 text-[16px] truncate [@media(max-height:700px)]:hidden">{t('onboardingAddDemoName')}</div>
      <div className="flex gap-2 mt-2.5">
        {photos.map((p, i) => (
          <span key={p} className={`${s.photoIn} block w-16 h-16 rounded-[14px] overflow-hidden`} style={{ animationDelay: `${1750 + i * 150}ms` }}>
            <ScenePhoto kind={p} className="w-full h-full" />
          </span>
        ))}
        <span className="w-16 h-16 rounded-[14px] border-[1.5px] border-dashed border-white/20 grid place-items-center text-label-tertiary">
          <Camera className="w-5 h-5" strokeWidth={2} />
        </span>
      </div>
      <span className="mt-2.5 inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-brand-500/18 text-brand-300 text-[14px] font-semibold [@media(max-height:700px)]:hidden">
        <CategoryIcon category="scenic" className="w-4 h-4" />
        {t('categoryScenic')}
      </span>
    </div>
  );
}

const CHROME_STEPS: readonly OnboardingStep[] = ['discover', 'add', 'levels'];
const DOCK_STEPS: readonly OnboardingStep[] = ['add'];

export default function SceneOverlays({ step, exploring }: Readonly<{ step: OnboardingStep; exploring: boolean }>) {
  return (
    <>
      <Controls on={CHROME_STEPS.includes(step) && !exploring} />
      <Dock on={DOCK_STEPS.includes(step)} pressing={step === 'add'} />
      {step === 'discover' && !exploring && <PlaceCard />}
      {step === 'discover' && exploring && <ExploreSheet />}
      {step === 'add' && <AddSheet />}
    </>
  );
}
