'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { X } from 'lucide-react';
import { useHorizontalSwipe } from '@/hooks/useHorizontalSwipe';
import { SWIPE_THRESHOLDS, Z } from '@/lib/constants';

interface GalleryProps {
  urls: string[];
  open: boolean;
  /** Image shown first each time the gallery opens. */
  startIndex: number;
  onClose: () => void;
  /** Base alt text; each image gets "<alt> - Image N". */
  alt: string;
}

/** Fullscreen image gallery: swipe, ←/→ and Esc, dots. Renders nothing while closed or without images. */
export default function Gallery({ urls, open, startIndex, onClose, alt }: Readonly<GalleryProps>) {
  if (!open || urls.length === 0) return null;
  // Mounted per opening, so the index starts at startIndex every time.
  return <GalleryView urls={urls} startIndex={startIndex} onClose={onClose} alt={alt} />;
}

function GalleryView({ urls, startIndex, onClose, alt }: Readonly<Omit<GalleryProps, 'open'>>) {
  const count = urls.length;
  const [current, setCurrent] = useState(startIndex);
  // The URL list is live (it can shrink while open): never index past its end.
  const index = Math.min(current, count - 1);

  const nextImage = useCallback(() => {
    setCurrent((prev) => (Math.min(prev, count - 1) + 1) % count);
  }, [count]);

  const prevImage = useCallback(() => {
    setCurrent((prev) => (Math.min(prev, count - 1) - 1 + count) % count);
  }, [count]);

  // Gallery swipe: the image follows the finger; navigation only with more than one image
  const swipe = useHorizontalSwipe({
    threshold: SWIPE_THRESHOLDS.gallery,
    direction: 'both',
    onSwipe: (side) => (side === 'right' ? prevImage() : nextImage()),
    enabled: count > 1,
  });

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') nextImage();
      if (e.key === 'ArrowLeft') prevImage();
      if (e.key === 'Escape') onClose();
    };
    globalThis.addEventListener('keydown', handleKeyDown);
    return () => globalThis.removeEventListener('keydown', handleKeyDown);
  }, [nextImage, prevImage, onClose]);

  return (
    <div className={`fixed inset-x-0 top-0 h-app ${Z.gallery} bg-black`} {...swipe.handlers}>
      <button
        onClick={onClose}
        className="absolute z-20 p-3 rounded-full bg-black/50 active:bg-black/70 transition-colors touch-manipulation"
        style={{ top: 'calc(env(safe-area-inset-top, 0px) + 1rem)', right: '1rem' }}
      >
        <X className="w-6 h-6 text-white" />
      </button>

      {count > 1 && (
        <div
          className="absolute z-20 text-white text-sm bg-black/50 px-3 py-1.5 rounded-full"
          style={{ top: 'calc(env(safe-area-inset-top, 0px) + 1rem)', left: '1rem' }}
        >
          {index + 1} / {count}
        </div>
      )}

      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{
          transform: swipe.dragging ? `translateX(${swipe.offset}px)` : 'translateX(0)',
          transition: swipe.dragging ? 'none' : 'transform 0.2s ease-out',
        }}
      >
        <Image src={urls[index]} alt={`${alt} - Image ${index + 1}`} fill sizes="100vw" className="object-contain" priority draggable={false} />
      </div>

      {count > 1 && (
        <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-2 z-20" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
          {urls.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`h-2 rounded-full transition-all touch-manipulation ${i === index ? 'bg-white w-6' : 'bg-white/40 w-2'}`}
              aria-label={`Go to image ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
