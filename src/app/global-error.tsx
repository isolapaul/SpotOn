'use client';

import './globals.css';
import ErrorScreen from '@/components/ErrorScreen';

// An error in the root layout itself: the boundary must bring its own <html> and <body>.
export default function GlobalError({ reset }: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return (
    <html lang="hu">
      <body className="font-sans">
        <ErrorScreen kind="error" onRetry={reset} />
      </body>
    </html>
  );
}
