import { NextRequest, NextResponse } from 'next/server';
import { buildCsp } from '@/lib/csp.mjs';

// Nonce-based page CSP (T32). Every page request gets a fresh nonce. Next reads it from the request
// Content-Security-Policy header during SSR and puts it on its own scripts (pages are dynamically
// rendered: see layout.tsx). NODE_ENV and NEXT_PUBLIC_USE_EMULATORS are inlined at build time, so the
// policy flavour is fixed per build, exactly as T15's headers() policy was.
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('base64'); // 128 bits
  const csp = buildCsp({
    nonce,
    isDev: process.env.NODE_ENV !== 'production', // same isDev rule as next.config.mjs (T15)
    useEmulators: process.env.NEXT_PUBLIC_USE_EMULATORS === '1',
  });
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

// Pages only. Excluded: /api/* (static policy from next.config.mjs headers(), the FCM worker needs it),
// Next's static assets, the exact public/ files and folders (a CSP on non-documents has no effect), the
// Android asset links (/.well-known/assetlinks.json), and the proxied
// Firebase auth paths that headers() also excludes (/__/auth/*, /__/firebase/init.json: their handler
// pages carry their own inline scripts and must never get our policy). Everything else, including 404
// pages for unknown paths, gets the nonce policy. Router prefetches (next-router-prefetch) skip it; a
// legacy `Purpose: prefetch` request does not, so it can never yield an HTML page without a CSP.
export const config = {
  matcher: [
    {
      source: '/((?!api/|_next/static/|_next/image$|__/auth(?:/|$)|__/firebase/init\\.json$|manifest\\.json$|icon-(?:maskable-|monochrome-)?(?:192x192|512x512)\\.png$|apple-touch-icon\\.png$|screenshots/[^/]+\\.jpg$|\\.well-known/assetlinks\\.json$|placeholder-spot\\.jpg$|patch-notes\\.md$).*)',
      missing: [{ type: 'header', key: 'next-router-prefetch' }],
    },
  ],
};
