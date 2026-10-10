'use client';

import { useEffect } from 'react';
import ErrorScreen from '@/components/ErrorScreen';

// The app's error boundary: a render error shows a way out instead of a blank page.
export default function Error({ error, reset }: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  useEffect(() => {
    console.error('App error:', error);
  }, [error]);
  return <ErrorScreen kind="error" onRetry={reset} />;
}
