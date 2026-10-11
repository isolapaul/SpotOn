import { buildAssetLinks, parseFingerprints } from '@/lib/assetLinks';

// Read per request: ANDROID_CERT_SHA256 is a runtime setting (the server's .env), so the Play signing
// fingerprint can be added without a new image (docs/deploy.md §17).
export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json(buildAssetLinks(parseFingerprints(process.env.ANDROID_CERT_SHA256)), {
    headers: { 'Cache-Control': 'public, max-age=300' },
  });
}
