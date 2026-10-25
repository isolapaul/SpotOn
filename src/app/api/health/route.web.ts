import { appVersion } from '@/lib/appVersion';

export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json(
    { status: 'ok', version: appVersion(process.env.APP_VERSION) },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
