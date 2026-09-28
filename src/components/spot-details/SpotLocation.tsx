'use client';

import { MapPin } from 'lucide-react';
import type { Spot } from '@/store/useSpotStore';
import { useT } from '@/hooks/useT';

interface SpotLocationProps {
  location: Spot['location'];
  navigationUrl: string;
}

/** Coordinates card with the "open in maps" link. */
export default function SpotLocation({ location, navigationUrl }: Readonly<SpotLocationProps>) {
  const t = useT();
  return (
    <div className="glass-card p-4 flex items-start gap-3">
      <MapPin className="w-5 h-5 text-primary-400 mt-0.5 flex-shrink-0" />
      <div>
        <p className="text-white/80 text-sm">{location.lat.toFixed(6)}, {location.lng.toFixed(6)}</p>
        <a href={navigationUrl} target="_blank" rel="noopener noreferrer" className="text-primary-400 text-sm font-medium mt-1 hover:underline inline-block">
          {t('openInMaps')} →
        </a>
      </div>
    </div>
  );
}
