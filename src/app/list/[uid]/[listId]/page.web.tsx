import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { fetchPublicListPreview } from '@/lib/publicListPreview';
import { translate } from '@/lib/i18n';

// A public list's web page (growth plan §7): server-rendered for search engines and link previews,
// in Hungarian (the site's default). Each spot opens in the app (/spot/<id>).

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://spoton.isolapaul.hu';
const tr = (key: Parameters<typeof translate>[1], params?: Record<string, string | number>) => translate('hu', key, params);

type Params = { params: Promise<{ uid: string; listId: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { uid, listId } = await params;
  const list = await fetchPublicListPreview(uid, listId);
  if (!list) return { title: 'SpotOn' };
  const title = `${list.name} · SpotOn`;
  const description = tr('publicListMeta', { owner: list.owner || 'SpotOn', count: list.spots.length, names: list.spots.slice(0, 4).map((s) => s.name).join(', ') });
  const image = list.spots.find((s) => s.imageUrl)?.imageUrl;
  return {
    metadataBase: new URL(SITE),
    title,
    description,
    alternates: { canonical: `/list/${uid}/${listId}` },
    openGraph: { title: list.name, description, siteName: 'SpotOn', type: 'website', images: [{ url: image ?? '/icon-512x512.png' }] },
    twitter: { card: image ? 'summary_large_image' : 'summary', title: list.name, description },
  };
}

export default async function PublicListPage({ params }: Params) {
  const { uid, listId } = await params;
  const list = await fetchPublicListPreview(uid, listId);
  if (!list) notFound();
  return (
    <main className="min-h-dvh bg-surface-0 text-label">
      <div className="mx-auto max-w-[720px] px-5 py-8">
        <Link href="/" className="inline-flex items-center gap-2 font-bold text-[18px]">
          <span className="w-8 h-8 rounded-[9px] bg-brand-600 grid place-items-center text-white text-[15px]">S</span>
          SpotOn
        </Link>
        <h1 className="mt-8 text-[34px] leading-tight font-extrabold">{list.name}</h1>
        <p className="mt-2 text-label-secondary">
          {list.owner ? tr('publicListBy', { owner: list.owner }) : null}
          {list.owner ? ' · ' : null}
          {tr(list.spots.length === 1 ? 'listSpotCountOne' : 'listSpotCount', { count: list.spots.length })}
        </p>
        <ul className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {list.spots.map((spot) => (
            <li key={spot.id}>
              <a href={`/spot/${encodeURIComponent(spot.id)}`} className="block rounded-[18px] overflow-hidden bg-surface-1 ring-1 ring-white/6 hover:ring-brand-400/50 transition">
                {spot.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- user photos on Firebase Storage
                  <img src={spot.imageUrl} alt="" loading="lazy" className="w-full aspect-[4/3] object-cover" />
                ) : (
                  <span className="block w-full aspect-[4/3] bg-gradient-to-br from-brand-800 to-brand-500" />
                )}
                <span className="block p-4">
                  <span className="block font-semibold text-[17px]">{spot.name}</span>
                  {spot.rating !== null && <span className="block mt-1 text-[14px] text-label-secondary">★ {spot.rating.toFixed(1).replace('.', ',')}</span>}
                  {spot.description && <span className="block mt-2 text-[14px] text-label-secondary line-clamp-2">{spot.description}</span>}
                </span>
              </a>
            </li>
          ))}
        </ul>
        <Link href="/" className="mt-10 flex items-center justify-center h-12 rounded-full bg-brand-600 text-white font-semibold">
          {tr('publicListOpenApp')}
        </Link>
      </div>
    </main>
  );
}
