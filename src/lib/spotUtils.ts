import type { Spot } from '@/store/useSpotStore';

export const categoryEmojis: Record<Spot['category'], string> = {
  scenic: '🌅',
  'smoke-spot': '💨',
  viewpoint: '🏔️',
  other: '📍',
};

export const categoryLabels: Record<Spot['category'], { hu: string; en: string; de: string }> = {
  scenic: { hu: 'Szép Kilátás', en: 'Scenic View', de: 'Malerische Aussicht' },
  'smoke-spot': { hu: 'Eldugott Spot', en: 'Hidden Spot', de: 'Versteckter Ort' },
  viewpoint: { hu: 'Kilátópont', en: 'Viewpoint', de: 'Aussichtspunkt' },
  other: { hu: 'Park/Bokor', en: 'Park/Bush', de: 'Park/Busch' },
};

export const getPlatform = (): 'ios' | 'android' | 'desktop' => {
  const userAgent = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(userAgent)) return 'ios';
  if (/android/.test(userAgent)) return 'android';
  return 'desktop';
};

export const getNavigationUrl = (lat: number, lng: number): string => {
  const platform = getPlatform();
  if (platform === 'ios') {
    return `maps://maps.apple.com/?q=${lat},${lng}`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
};
