import { firestoreRestUrl } from '@/lib/spotPreview';

// Growth plan §7: /sitemap.xml with the approved spots and the public lists for search engines
// (Firestore REST with the public config; the rules allow exactly these queries). A route handler
// (web build only): metadata routes do not take the .web extension. Cached for an hour.
export const revalidate = 3600;

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://spoton.isolapaul.hu';
const MAX = 5000;

type Row = { document?: { name?: string; updateTime?: string } };

async function runQuery(structuredQuery: object): Promise<Row[]> {
  const url = firestoreRestUrl('', ':runQuery');
  if (!url) return [];
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ structuredQuery }),
      next: { revalidate: 3600 },
    });
    return res.ok ? ((await res.json()) as Row[]) : [];
  } catch {
    return [];
  }
}

type Entry = { url: string; lastModified?: string };

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function entries(): Promise<Entry[]> {
  const [spots, lists] = await Promise.all([
    runQuery({
      from: [{ collectionId: 'spots' }],
      where: { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'approved' } } },
      select: { fields: [{ fieldPath: 'name' }] },
      limit: MAX,
    }),
    runQuery({
      from: [{ collectionId: 'lists', allDescendants: true }],
      where: { fieldFilter: { field: { fieldPath: 'public' }, op: 'EQUAL', value: { booleanValue: true } } },
      select: { fields: [{ fieldPath: 'name' }] },
      limit: MAX,
    }),
  ]);
  const entry = (path: string, updated?: string): Entry => ({ url: `${SITE}${path}`, ...(updated ? { lastModified: updated } : {}) });
  const parts = (r: Row) => (r.document?.name?.split('/documents/')[1] ?? '').split('/');
  const out: Entry[] = [entry('/')];
  for (const r of spots) {
    const p = parts(r); // spots/{id}
    if (p.length === 2 && p[1]) out.push(entry(`/spot/${p[1]}`, r.document?.updateTime));
  }
  for (const r of lists) {
    const p = parts(r); // users/{uid}/lists/{id}
    if (p.length === 4) out.push(entry(`/list/${p[1]}/${p[3]}`, r.document?.updateTime));
  }
  return out;
}

export async function GET(): Promise<Response> {
  const urls = (await entries())
    .map((e) => `<url><loc>${escapeXml(e.url)}</loc>${e.lastModified ? `<lastmod>${escapeXml(e.lastModified)}</lastmod>` : ''}</url>`)
    .join('');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`, {
    headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600' },
  });
}
