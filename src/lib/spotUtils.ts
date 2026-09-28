// Spot helpers. The category maps moved to categories.ts (T23) and are re-exported under their
// old names so existing imports keep working.
import { CATEGORY_EMOJI, CATEGORY_LABEL_KEY } from './categories';

export const categoryEmojis = CATEGORY_EMOJI;

export const categoryTranslationKeys = CATEGORY_LABEL_KEY;

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
