import { useEffect } from 'react';

/** URLs already requested in this session (each is fetched once). */
const requested = new Set<string>();

/**
 * Fetches images ahead of time (the feed's next cards), so they are in the browser cache when they
 * scroll into view. Low priority, never blocks anything; failures are ignored.
 */
export function useImagePrefetch(urls: readonly string[]): void {
  const key = urls.join('\n');
  useEffect(() => {
    if (typeof window === 'undefined' || !key) return;
    for (const url of key.split('\n')) {
      if (!url || requested.has(url)) continue;
      requested.add(url);
      const img = new window.Image();
      img.decoding = 'async';
      (img as HTMLImageElement & { fetchPriority?: string }).fetchPriority = 'low';
      img.src = url;
    }
  }, [key]);
}
