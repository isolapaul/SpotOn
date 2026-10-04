/** The SpotOn app icon (public/icon-512x512.png) as SVG: the heart pin on the brand tile. */
export default function AppIcon({ size, className }: Readonly<{ size: number; className?: string }>) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" aria-hidden="true" focusable="false" className={className}>
      <rect width="96" height="96" rx="22" fill="#16A064" />
      <path d="M48 78S26 60 26 41a22 22 0 0 1 44 0c0 19-22 37-22 37z" fill="none" stroke="#fff" strokeWidth="6" strokeLinejoin="round" />
      <path
        d="M48 49.5s-9-5.2-9-10.9c0-3 2.2-5.1 4.9-5.1 1.8 0 3.3 1 4.1 2.4.8-1.4 2.3-2.4 4.1-2.4 2.7 0 4.9 2.1 4.9 5.1 0 5.7-9 10.9-9 10.9z"
        fill="#fff"
      />
    </svg>
  );
}
