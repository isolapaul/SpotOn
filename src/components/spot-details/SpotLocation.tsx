'use client';

import { ChevronRight, MapPin } from 'lucide-react';
import type { Spot } from '@/store/useSpotStore';
import { useT } from '@/hooks/useT';

interface SpotLocationProps {
  location: Spot['location'];
  navigationUrl: string;
}

/** Info card row (design phase 3): coordinates with the "open in maps" link. */
export default function SpotLocation({ location, navigationUrl }: Readonly<SpotLocationProps>) {
  const t = useT();
  return (
    <a
      href={navigationUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="no-min-size flex items-center gap-3.5 px-4 py-3 active:bg-white/[.04] transition-colors"
    >
      <MapPin className="w-5 h-5 text-brand-400 flex-shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] text-label tabular-nums">{location.lat.toFixed(6)}, {location.lng.toFixed(6)}</span>
        <span className="block text-[13px] text-brand-400 font-medium">{t('openInMaps')}</span>
      </span>
      <ChevronRight className="w-4 h-4 text-label-tertiary" aria-hidden="true" />
    </a>
  );
}
