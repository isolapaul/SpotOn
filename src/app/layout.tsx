import type { Metadata, Viewport } from 'next';
import { connection } from 'next/server';
import './globals.css';
import InstallGate from '@/components/InstallGate';

export const metadata: Metadata = {
  title: 'SpotOn - Discover Scenic Locations',
  description: 'Discover and share hidden gems, viewpoints and scenic places near you.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    // See-through: the map runs under the status bar. iOS 26 then sizes the page a status bar short;
    // hooks/useStandaloneFullHeight corrects that (design 1A).
    statusBarStyle: 'black-translucent',
    title: 'SpotOn',
    startupImage: [
      {
        url: '/icon-512x512.png',
        media: '(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)',
      },
    ],
  },
  formatDetection: {
    telephone: false,
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#0E1013',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Nonce CSP (T32): render per request, so Next can put src/proxy.ts's fresh nonce on its scripts.
  await connection();
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/icon-192x192.png" type="image/png" />
        <link rel="apple-touch-icon" href="/icon-192x192.png" />
      </head>
      <body className="font-sans">
        <InstallGate />
        {children}
      </body>
    </html>
  );
}
