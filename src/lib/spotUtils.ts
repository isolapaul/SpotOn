// Spot helpers. Category labels: hooks/useCategory (item 7).

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
