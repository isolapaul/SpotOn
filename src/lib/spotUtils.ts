import type { SpotCategory } from '@/store/useSpotStore';
import type { TranslationKey } from '@/lib/translations';

export const categoryEmojis: Record<SpotCategory, string> = {
  scenic: '🌅',
  'smoke-spot': '💨',
  viewpoint: '🏔️',
  other: '📍',
  hiking: '🥾',
  random: '🎲',
  'date-spot': '❤️',
  park: '🌳',
};

export const categoryTranslationKeys: Record<SpotCategory, TranslationKey> = {
  scenic: 'categoryScenic',
  'smoke-spot': 'categorySmoke',
  viewpoint: 'categoryViewpoint',
  other: 'categoryOther',
  hiking: 'categoryHiking',
  random: 'categoryRandom',
  'date-spot': 'categoryDateSpot',
  park: 'categoryPark',
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
