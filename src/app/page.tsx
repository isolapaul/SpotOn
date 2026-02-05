'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import BottomNavigation from '@/components/BottomNavigation';

// Dynamic import to avoid SSR issues with Leaflet
const MapView = dynamic(() => import('@/components/MapView'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[100dvh] bg-slate-900 flex items-center justify-center">
      <div className="glass-card px-8 py-4">
        <p className="text-white font-medium">Loading map...</p>
      </div>
    </div>
  ),
});

export default function Home() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return null;
  }

  return (
    <main className="relative w-full h-[100dvh] overflow-hidden">
      {/* Full-screen map background */}
      <MapView />
      
      {/* Bottom Navigation - Floating Dock */}
      <BottomNavigation />
    </main>
  );
}
