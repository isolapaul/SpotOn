'use client';

import { MapPin } from 'lucide-react';
import { useT } from '@/hooks/useT';

interface LocationSectionProps {
  isRequesting: boolean;
  onRequest: () => void;
}

/** Settings › ask for the device location again. */
export default function LocationSection({ isRequesting, onRequest }: Readonly<LocationSectionProps>) {
  const t = useT();

  return (
    <div className="rounded-[18px] bg-surface-1 p-5">
      <h3 className="text-[13px] font-semibold uppercase tracking-wide text-label-tertiary mb-3 flex items-center gap-2">
        <MapPin className="w-5 h-5" />
        {t('locationHeader')}
      </h3>
      
      <button
        onClick={onRequest}
        disabled={isRequesting}
        className="w-full py-3 px-4 rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-2
          bg-brand-600 text-white active:bg-brand-700 disabled:opacity-50"
      >
        <MapPin className="w-5 h-5" />
        {isRequesting ? t('locationRequesting') : t('requestLocationPermission')}
      </button>
    </div>
  );
}
