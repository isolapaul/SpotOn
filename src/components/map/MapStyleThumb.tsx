import type { MapTheme } from '@/store/useMapThemeStore';

// A hand-drawn mini map per style (design 1C): same geometry, the style's own palette.
const PALETTES: Record<MapTheme, { bg: string; park: string; water: string; road: string }> = {
  standard: { bg: '#F2EFE9', park: '#CDEBB8', water: '#AAD3DF', road: '#FFFFFF' },
  light: { bg: '#FAFAF8', park: '#E6EFE3', water: '#D4DEE6', road: '#FFFFFF' },
  silver: { bg: '#F3F1EC', park: '#DCEBD4', water: '#B8D6E8', road: '#FAD7A0' },
  dark: { bg: '#1B1C1E', park: '#23282A', water: '#0E1215', road: '#3A3C40' },
  satellite: { bg: '#3E4A33', park: '#2F3B26', water: '#1F3444', road: '#9C9588' },
};

export default function MapStyleThumb({ theme }: Readonly<{ theme: MapTheme }>) {
  const p = PALETTES[theme];
  return (
    <svg width="36" height="36" viewBox="0 0 40 40" aria-hidden="true" className="shrink-0 rounded-[9px] ring-1 ring-black/10">
      <rect width="40" height="40" fill={p.bg} />
      <rect x="4" y="5" width="14" height="10" rx="3" fill={p.park} />
      <path d="M-2 30c10-6 16 4 26-2s12-10 18-8" fill="none" strokeWidth="6" stroke={p.water} />
      <path d="M26 -2 22 42M-2 20h44" fill="none" strokeWidth="3" stroke={p.road} />
    </svg>
  );
}
