import { buildAppleAppSite, parseTeamId } from '@/lib/appleAppSite';

// Universal Links for the iOS app: read per request, since APPLE_TEAM_ID is a runtime setting
// (the server's .env, docs/deploy.md §17.4), like ANDROID_CERT_SHA256 for the Android App Links.
export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json(buildAppleAppSite(parseTeamId(process.env.APPLE_TEAM_ID)), {
    headers: { 'Cache-Control': 'public, max-age=300' },
  });
}
