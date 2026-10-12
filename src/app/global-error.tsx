'use client';

import './globals.css';
import ErrorScreen from '@/components/ErrorScreen';
import { useEffect } from 'react';
import { reportError } from '@/store/telemetry';

// An error in the root layout itself: the boundary must bring its own <html> and <body>.
export default function GlobalError({ error, reset }: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  useEffect(() => reportError(error), [error]);
  return (
    <html lang="hu">
      <body className="font-sans">
        <ErrorScreen kind="error" onRetry={reset} />
      </body>
    </html>
  );
}
